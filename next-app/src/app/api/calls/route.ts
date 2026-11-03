export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { randomUUID } from "crypto";
import { getPrisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { findContactGate, resolveUserId } from "@/lib/db";
import { badRequest, forbidden } from "@/lib/errors";
import { handleError, json, readJson, asString } from "@/lib/http";
import { requireCallGate } from "@/lib/validation";
import { validateSignalMessage } from "@/lib/webrtc";

/**
 * POST/GET /api/calls — Step 4 adds the REST signalling transport
 * used when the Socket.io custom server is not running: POST signal
 * QUEUES offer/answer/ICE for the other party, and GET ?callId=
 * delivers that party's queued signals (consumed on delivery) plus
 * the call's ringing/accepted status. When the custom server IS
 * running (server.mjs), the client prefers live socket relay and
 * still uses these routes for invite/accept/decline/end + CallLog.
 * No WebRTC media runs here — the server relays signalling only and
 * never sees media. Calls are in-app only; a Communica ID is never
 * dialled as a phone number.
 *
 * Gate (ALGORITHMS §7): the callee must have ACCEPTED the caller
 * (Contact ownerId=callee, contactUserId=caller, accepted=true,
 * isBlocked=false), otherwise 403. A CallLog is written for EVERY
 * attempt (missed/declined/busy included). ACCEPTED is transient: an
 * accepted call that ends is updated to ENDED.
 *
 * Single-process note (same as backend/src/calls.ts): active calls
 * live in a module-level Map. App Router/serverless deployments must
 * move this to shared state or pin signalling before multi-instance
 * use. The 30-second ringing timeout is enforced lazily: expired
 * ringing calls are swept to MISSED logs at the start of each
 * request, since there is no long-running process here.
 */
const RINGING_TIMEOUT_MS = 30 * 1000;

interface QueuedSignal {
  to: string;
  kind: "offer" | "answer" | "ice";
  payload: Record<string, unknown>;
}
interface ActiveCall {
  callId: string;
  callerId: string;
  calleeId: string;
  chatId: string | null;
  type: "AUDIO" | "VIDEO";
  ringingSince: Date;
  startedAt: Date | null;
  callLogId: string | null;
  /** REST-transport signal queue; consumed on delivery (GET ?callId=). */
  signals: QueuedSignal[];
}
const activeCalls = new Map<string, ActiveCall>();
/** Final outcomes, kept briefly so polling clients learn the reason a
 *  call ended (declined / cancelled / missed / ended) instead of a
 *  bare "gone". Never a substitute for the CallLog row. F18: the
 *  parties are recorded WITH the outcome, so the GET branch can
 *  enforce the same party check as for active calls — a stranger
 *  gets 403, never the outcome. */
const callOutcomes = new Map<string, { status: string; callerId: string; calleeId: string }>();
function recordOutcome(callId: string, status: string, callerId: string, calleeId: string): void {
  callOutcomes.set(callId, { status, callerId, calleeId });
  if (callOutcomes.size > 200) {
    const first = callOutcomes.keys().next().value;
    if (first !== undefined) callOutcomes.delete(first);
  }
}

async function sweepExpired(prisma: ReturnType<typeof getPrisma>): Promise<void> {
  const now = Date.now();
  const jobs: Promise<unknown>[] = [];
  activeCalls.forEach((call, callId) => {
    if (now - call.ringingSince.getTime() >= RINGING_TIMEOUT_MS) {
      jobs.push(prisma.callLog.create({
        data: { chatId: call.chatId, callerId: call.callerId, calleeId: call.calleeId, type: call.type, status: "MISSED", startedAt: call.ringingSince },
      }));
      activeCalls.delete(callId);
      recordOutcome(callId, "MISSED", call.callerId, call.calleeId);
    }
  });
  await Promise.all(jobs);
}

/** GET /api/calls — recent CallLogs (caller OR callee, newest first),
 *  OR ?callId=<id> for one call's ringing/accepted status + this
 *  party's queued signals (consumed on delivery), OR ?incoming=1 for
 *  ringing calls addressed to the signed-in user. Party checks apply
 *  to the single-call forms; strangers learn nothing about a call. */
export async function GET(request: Request) {
  try {
    const auth = requireAuth(request);
    const prisma = getPrisma();
    await sweepExpired(prisma);
    const params = new URL(request.url).searchParams;
    const singleId = params.get("callId");
    if (singleId) {
      const call = activeCalls.get(singleId);
      if (call) {
        if (auth.userId !== call.callerId && auth.userId !== call.calleeId) throw forbidden("not a party to this call");
        const mine = call.signals.filter((s) => s.to === auth.userId);
        call.signals = call.signals.filter((s) => s.to !== auth.userId);
        return json({
          status: call.startedAt !== null ? "accepted" : "ringing",
          callerId: call.callerId, calleeId: call.calleeId, type: call.type,
          signals: mine.map((s) => ({ callId: singleId, kind: s.kind, payload: s.payload })),
        });
      }
      const outcome = callOutcomes.get(singleId);
      if (outcome) {
        if (auth.userId !== outcome.callerId && auth.userId !== outcome.calleeId) throw forbidden("not a party to this call");
        return json({ status: outcome.status, signals: [] });
      }
      throw forbidden("not a party to this call");
    }
    if (params.get("incoming") === "1") {
      const incoming: Array<{ callId: string; callerId: string; type: string; chatId: string | null }> = [];
      activeCalls.forEach((call) => {
        if (call.calleeId === auth.userId) {
          incoming.push({ callId: call.callId, callerId: call.callerId, type: call.type, chatId: call.chatId });
        }
      });
      return json({ incoming });
    }
    const limit = Math.min(Math.max(parseInt(params.get("limit") ?? "50", 10) || 50, 1), 100);
    const logs = await prisma.callLog.findMany({
      where: { OR: [{ callerId: auth.userId }, { calleeId: auth.userId }] },
      orderBy: { startedAt: "desc" },
      take: limit,
      include: { caller: { select: { username: true, displayName: true, communicaId: true } }, callee: { select: { username: true, displayName: true, communicaId: true } } },
    });
    return json({ calls: logs });
  } catch (err) {
    return handleError(err);
  }
}

/** POST /api/calls
 *  - start (default): { calleeId | calleeIdentifier, type, chatId? }
 *    => { status:"ringing", callId } or { status:"busy", callLogId }.
 *  - { action:"accept"|"decline"|"cancel"|"end", callId }
 *  - { action:"signal", callId, kind:"offer"|"answer"|"ice",
 *    payload } — party + shape validated, then QUEUED for the other
 *    party's GET ?callId= pickup (REST transport). When the Socket.io
 *    custom server is running, clients relay live over sockets
 *    instead and only use this queue as fallback. */
export async function POST(request: Request) {
  try {
    const auth = requireAuth(request);
    const prisma = getPrisma();
    await sweepExpired(prisma);
    const body = await readJson(request);
    const action = asString(body.action) || "start";
    const callId = asString(body.callId);

    if (action === "start") {
      const type = asString(body.type) || "AUDIO";
      if (type !== "AUDIO" && type !== "VIDEO") throw badRequest("call type is invalid");
      const calleeId = asString(body.calleeId) ? asString(body.calleeId) : await resolveUserId(prisma, asString(body.calleeIdentifier));
      if (calleeId === auth.userId) throw badRequest("cannot call yourself");
      const callee = await prisma.user.findUnique({ where: { id: calleeId } });
      if (callee === null) throw badRequest("user not found");
      requireCallGate(await findContactGate(prisma, calleeId, auth.userId));
      let busy = false;
      activeCalls.forEach((call) => { if (call.calleeId === calleeId) busy = true; });
      if (busy) {
        const log = await prisma.callLog.create({
          data: { chatId: typeof body.chatId === "string" ? body.chatId : null, callerId: auth.userId, calleeId, type: type as "AUDIO" | "VIDEO", status: "CANCELLED", startedAt: new Date() },
        });
        return json({ status: "busy", callId: null, callLogId: log.id });
      }
      const id = randomUUID();
      activeCalls.set(id, {
        callId: id, callerId: auth.userId, calleeId,
        chatId: typeof body.chatId === "string" ? body.chatId : null,
        type: type as "AUDIO" | "VIDEO", ringingSince: new Date(), startedAt: null, callLogId: null,
        signals: [],
      });
      return json({ status: "ringing", callId: id, callLogId: null, calleeId }, 201);
    }

    const call = activeCalls.get(callId);
    if (action === "signal") {
      if (!call) throw forbidden("not a party to this call");
      if (auth.userId !== call.callerId && auth.userId !== call.calleeId) throw forbidden("not a party to this call");
      if (call.startedAt === null) throw forbidden("call not accepted yet — signals are only relayed after accept");
      let signal;
      try {
        signal = validateSignalMessage({ callId, kind: body.kind, payload: body.payload });
      } catch {
        throw badRequest("signal message is invalid");
      }
      const otherId = auth.userId === call.callerId ? call.calleeId : call.callerId;
      call.signals.push({ to: otherId, kind: signal.kind, payload: signal.payload });
      return json({ queued: true, note: "signal queued for peer pickup via GET ?callId=; live relay runs over the Socket.io custom server when it is running" });
    }
    if (!call) throw forbidden("not a party to this call");
    if (action === "accept") {
      if (auth.userId !== call.calleeId) throw forbidden("only the callee can accept");
      const startedAt = new Date();
      const log = await prisma.callLog.create({
        data: { chatId: call.chatId, callerId: call.callerId, calleeId: auth.userId, type: call.type, status: "ACCEPTED", startedAt },
      });
      call.callLogId = log.id;
      call.startedAt = startedAt;
      return json({ callLog: log });
    }
    if (action === "decline") {
      if (auth.userId !== call.calleeId) throw forbidden("only the callee can decline");
      const log = await prisma.callLog.create({
        data: { chatId: call.chatId, callerId: call.callerId, calleeId: auth.userId, type: call.type, status: "DECLINED", startedAt: new Date() },
      });
      activeCalls.delete(callId);
      recordOutcome(callId, "DECLINED", call.callerId, call.calleeId);
      return json({ callLog: log });
    }
    if (action === "cancel") {
      if (auth.userId !== call.callerId) throw forbidden("only the caller can cancel an unanswered call");
      if (call.callLogId !== null) throw badRequest("call already accepted — use end, not cancel");
      const log = await prisma.callLog.create({
        data: { chatId: call.chatId, callerId: call.callerId, calleeId: call.calleeId, type: call.type, status: "CANCELLED", startedAt: call.ringingSince },
      });
      activeCalls.delete(callId);
      recordOutcome(callId, "CANCELLED", call.callerId, call.calleeId);
      return json({ callLog: log });
    }
    if (action === "end") {
      if (auth.userId !== call.callerId && auth.userId !== call.calleeId) throw forbidden("not a party to this call");
      if (call.callLogId === null || call.startedAt === null) throw badRequest("call not accepted yet — caller uses cancel");
      const endedAt = new Date();
      const durationSec = Math.max(0, Math.floor((endedAt.getTime() - call.startedAt.getTime()) / 1000));
      const updated = await prisma.callLog.update({
        where: { id: call.callLogId }, data: { status: "ENDED", endedAt, durationSec },
      });
      activeCalls.delete(callId);
      recordOutcome(callId, "ENDED", call.callerId, call.calleeId);
      return json({ callLog: updated });
    }
    throw badRequest("call action is invalid");
  } catch (err) {
    return handleError(err);
  }
}
