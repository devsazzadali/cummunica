// Communica backend — in-app call signalling (Step 7 skeleton).
// Implements ALGORITHMS §7 exactly. Calls are in-app WebRTC ONLY.
// No real phone number is ever dialled; User.communicaId is an
// in-app identifier and is never used as a dialling target.
//
// Gate rule (schema comment on Contact): a call is allowed ONLY when
// the callee has ACCEPTED the caller — a Contact row with
// ownerId=calleeId, contactUserId=callerId, accepted=true, and
// isBlocked=false. Until the user decides otherwise, calls from
// non-contacts are NOT allowed.
//
// Timestamps (ALGORITHMS §7, consistent across all paths):
// - ringingSince is set at REGISTER (startCall) and startedAt is NULL.
// - onCallAccepted sets startedAt=NOW and creates the CallLog.
// - onCallTimeout / onCallCancelled read ringingSince for the log's
//   startedAt; onCallEnded reads startedAt for the duration.
// CallLog is written for EVERY attempt (missed/declined/busy included),
// so the Recent Calls list is complete.
//
// Status mapping: ACCEPTED is transient ("was answered"); a call that
// was accepted and then ends is updated to ENDED. Caller hang-up
// before an answer is CANCELLED (never via onCallEnded, which requires
// an accepted call). No answer in 30 seconds is MISSED. Callee busy is
// CANCELLED from the caller's side and the callee is not interrupted.
//
// Signalling transport: Socket.io rooms user:{userId} for call events;
// media itself is peer-to-peer WebRTC once signalling completes — the
// server RELAYS signalling only and never sees media. TURN, if needed
// for strict NAT/firewall, is a media relay only, never a gateway to
// real phone numbers.
//
// SKELETON NOTE: active calls live in an in-memory Map. That is correct
// for a single server process; a multi-instance deployment must move
// this set to shared state (e.g. Redis) or pin a user's signalling to
// one instance — otherwise busy checks and timeouts diverge.

import type { CallLogRecord, CallType, EmitFn, NowFn } from "./types";
import { badRequest, forbidden } from "./errors";

export const RINGING_TIMEOUT_MS = 30 * 1000; // ALGORITHMS §7 chosen default

/** Narrow Db surface this module needs (production: Prisma Client). */
export interface CallsDb {
  findContactGate(calleeId: string, callerId: string): Promise<{
    accepted: boolean;
    isBlocked: boolean;
  } | null>;
  createCallLog(input: {
    chatId: string | null;
    callerId: string;
    calleeId: string;
    type: CallType;
    status: CallLogRecord["status"];
    startedAt: Date;
  }): Promise<CallLogRecord>;
  updateCallLog(
    callLogId: string,
    patch: Partial<Pick<CallLogRecord, "status" | "endedAt" | "durationSec">>,
  ): Promise<CallLogRecord>;
  listCallLogsForUser(userId: string, limit: number): Promise<CallLogRecord[]>;
}

/** In-memory active-call record (NOT a database row). */
export interface ActiveCall {
  callId: string;
  callerId: string;
  calleeId: string;
  chatId: string | null;
  type: CallType;
  ringingSince: Date;
  startedAt: Date | null;
  callLogId: string | null;
}

export type SignalKind = "offer" | "answer" | "ice";

export interface StartCallResult {
  status: "ringing" | "busy";
  callId: string | null;
  callLogId: string | null;
}

/**
 * Stateful signalling service. Production constructs one per server
 * process and wires `scheduleTimeout` to setTimeout(RINGING_TIMEOUT_MS)
 * calling handleTimeout. The clock is injectable for tests.
 */
export class CallService {
  private readonly active = new Map<string, ActiveCall>();

  constructor(
    private readonly db: CallsDb,
    private readonly emit: EmitFn,
    private readonly now: NowFn = () => new Date(),
    private readonly generateCallId: () => string,
    /** Production: setTimeout wrapper. Tests may pass a manual trigger. */
    private readonly scheduleTimeout: (callId: string) => void = () => undefined,
  ) {}

  private getActive(callId: string): ActiveCall | undefined {
    return this.active.get(callId);
  }

  private requireParty(call: ActiveCall, userId: string): void {
    if (userId !== call.callerId && userId !== call.calleeId) {
      throw forbidden("not a party to this call");
    }
  }

  /** ALGORITHMS §7 startCall: gate BEFORE any signalling. */
  async startCall(
    callerId: string,
    calleeId: string,
    chatId: string | null,
    type: CallType,
  ): Promise<StartCallResult> {
    const gate = await this.db.findContactGate(calleeId, callerId);
    if (gate === null || !gate.accepted || gate.isBlocked) {
      throw forbidden("calls are only allowed to accepted contacts");
    }

    for (const call of this.active.values()) {
      if (call.calleeId === calleeId) {
        const log = await this.db.createCallLog({
          chatId,
          callerId,
          calleeId,
          type,
          status: "CANCELLED",
          startedAt: this.now(),
        });
        return { status: "busy", callId: null, callLogId: log.id };
      }
    }

    const callId = this.generateCallId();
    const call: ActiveCall = {
      callId,
      callerId,
      calleeId,
      chatId,
      type,
      ringingSince: this.now(),
      startedAt: null,
      callLogId: null,
    };
    this.active.set(callId, call);
    this.emit(`user:${calleeId}`, "call:incoming", { callId, callerId, chatId, type });
    this.scheduleTimeout(callId);
    return { status: "ringing", callId, callLogId: null };
  }

  /** ALGORITHMS §7 onCallSignal: relay offer/answer/ICE to the other party only. */
  relaySignal(userId: string, callId: string, kind: SignalKind, payload: unknown): void {
    const call = this.getActive(callId);
    if (call === undefined) throw forbidden("not a party to this call");
    this.requireParty(call, userId);
    const otherId = userId === call.callerId ? call.calleeId : call.callerId;
    this.emit(`user:${otherId}`, "call:signal", { callId, kind, payload });
  }

  /** ALGORITHMS §7 onCallAccepted: only the callee; creates the log. */
  async acceptCall(calleeId: string, callId: string): Promise<CallLogRecord> {
    const call = this.getActive(callId);
    if (call === undefined || calleeId !== call.calleeId) {
      throw forbidden("only the callee can accept");
    }
    const startedAt = this.now();
    const log = await this.db.createCallLog({
      chatId: call.chatId,
      callerId: call.callerId,
      calleeId,
      type: call.type,
      status: "ACCEPTED",
      startedAt,
    });
    call.callLogId = log.id;
    call.startedAt = startedAt;
    this.emit(`user:${call.callerId}`, "call:accepted", { callId });
    return log;
  }

  /** ALGORITHMS §7 onCallDeclined: only the callee. */
  async declineCall(calleeId: string, callId: string): Promise<CallLogRecord> {
    const call = this.getActive(callId);
    if (call === undefined || calleeId !== call.calleeId) {
      throw forbidden("only the callee can decline");
    }
    const log = await this.db.createCallLog({
      chatId: call.chatId,
      callerId: call.callerId,
      calleeId,
      type: call.type,
      status: "DECLINED",
      startedAt: this.now(),
    });
    this.active.delete(callId);
    this.emit(`user:${call.callerId}`, "call:declined", { callId });
    return log;
  }

  /** ALGORITHMS §7 onCallCancelled: caller hangs up BEFORE an answer.
   *  Rejected once accepted — accepted calls use endCall instead. */
  async cancelCall(callerId: string, callId: string): Promise<CallLogRecord> {
    const call = this.getActive(callId);
    if (call === undefined || callerId !== call.callerId) {
      throw forbidden("only the caller can cancel an unanswered call");
    }
    if (call.callLogId !== null) {
      throw badRequest("call already accepted — use onCallEnded, not cancel");
    }
    const log = await this.db.createCallLog({
      chatId: call.chatId,
      callerId: call.callerId,
      calleeId: call.calleeId,
      type: call.type,
      status: "CANCELLED",
      startedAt: call.ringingSince,
    });
    this.active.delete(callId);
    this.emit(`user:${call.calleeId}`, "call:cancelled", { callId });
    this.emit(`user:${call.callerId}`, "call:cancelled", { callId });
    return log;
  }

  /** ALGORITHMS §7 onCallTimeout: no answer within 30 seconds. */
  async handleTimeout(callId: string): Promise<CallLogRecord | null> {
    const call = this.getActive(callId);
    if (call === undefined) return null; // Already answered/declined/cancelled.
    const log = await this.db.createCallLog({
      chatId: call.chatId,
      callerId: call.callerId,
      calleeId: call.calleeId,
      type: call.type,
      status: "MISSED",
      startedAt: call.ringingSince,
    });
    this.active.delete(callId);
    this.emit(`user:${call.callerId}`, "call:missed", { callId });
    this.emit(`user:${call.calleeId}`, "call:missed", { callId });
    return log;
  }

  /** ALGORITHMS §7 onCallEnded: ONLY for accepted calls. */
  async endCall(userId: string, callId: string): Promise<CallLogRecord> {
    const call = this.getActive(callId);
    if (call === undefined) throw forbidden("not a party to this call");
    this.requireParty(call, userId);
    if (call.callLogId === null || call.startedAt === null) {
      throw badRequest("call not accepted yet — caller uses onCallCancelled");
    }
    const endedAt = this.now();
    const durationSec = Math.max(
      0,
      Math.floor((endedAt.getTime() - call.startedAt.getTime()) / 1000),
    );
    const updated = await this.db.updateCallLog(call.callLogId, {
      status: "ENDED",
      endedAt,
      durationSec,
    });
    this.active.delete(callId);
    this.emit(`user:${call.callerId}`, "call:ended", { callId, durationSec });
    this.emit(`user:${call.calleeId}`, "call:ended", { callId, durationSec });
    return updated;
  }

  /** Recent Calls list (Calls tab): caller OR callee, newest first. */
  async listRecentCalls(userId: string, limit = 50): Promise<CallLogRecord[]> {
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    return this.db.listCallLogsForUser(userId, safeLimit);
  }

  /** Test/support helper: is this call still ringing or in progress? */
  hasActiveCall(callId: string): boolean {
    return this.active.has(callId);
  }
}
