export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { randomUUID } from "crypto";
import { getPrisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { isBlockedEitherDirection, resolveUserId } from "@/lib/db";
import { badRequest, forbidden } from "@/lib/errors";
import { handleError, json, readJson, asString } from "@/lib/http";
import { validateSignalMessage } from "@/lib/webrtc";

/**
 * POST/GET /api/calls — own REST signalling transport, DATABASE-backed.
 * Live-call state lives in ActiveCall + CallSignal tables, NOT in a
 * module-level Map. Vercel serverless has many instances; the old Map
 * lived in one instance only, so a call that rang in the banner could
 * read as "already ended" on the /call page (different instance).
 * That was the 2026-11-03 live bug, proved by the mobile screenshot
 * ("Could not load this incoming call. It may already have ended.")
 * User decision 2026-11-03: NO accept gate. Anyone who knows a
 * Communica ID / username can call that user directly. Only Block
 * stops a caller (either direction). Contacts/Accept remain for
 * organising contacts, not for gating calls.
 * No WebRTC media runs here — the server relays signalling only and
 * never sees media. Calls are in-app only; a Communica ID is never
 * dialled as a phone number. Ringing timeout is 30 seconds, enforced
 * lazily at the start of each request (no long-running process).
 */
const RINGING_TIMEOUT_MS = 30 * 1000;
const OUTCOME_KEEP_MS = 10 * 60 * 1000;

async function sweepExpired(prisma: ReturnType<typeof getPrisma>): Promise<void> {
  const now = new Date();
  try {
    const expired = await prisma.activeCall.findMany({
      where: { status: "RINGING", ringingSince: { lt: new Date(now.getTime() - RINGING_TIMEOUT_MS) } },
    });
    for (const call of expired) {
      try {
        const log = await prisma.callLog.create({
          data: { chatId: call.chatId, callerId: call.callerId, calleeId: call.calleeId, type: call.type, status: "MISSED", startedAt: call.ringingSince },
        });
        await prisma.activeCall.update({ where: { id: call.id }, data: { status: "MISSED", callLogId: log.id } });
      } catch { /* sweep must never break the request it precedes */ }
    }
    const old = new Date(now.getTime() - OUTCOME_KEEP_MS);
    await prisma.callSignal.deleteMany({ where: { createdAt: { lt: old } } });
    const stale = await prisma.activeCall.findMany({
      where: { updatedAt: { lt: old }, status: { notIn: ["RINGING", "ACCEPTED"] } },
      select: { id: true },
    });
    if (stale.length > 0) {
      await prisma.callSignal.deleteMany({ where: { callId: { in: stale.map((c) => c.id) } } });
      await prisma.activeCall.deleteMany({ where: { id: { in: stale.map((c) => c.id) } } });
    }
  } catch { /* sweep is best-effort */ }
}

export async function GET(request: Request) {
  try {
    const auth = requireAuth(request);
    const prisma = getPrisma();
    await sweepExpired(prisma);
    const params = new URL(request.url).searchParams;
    const singleId = params.get("callId");
    if (singleId) {
      const call = await prisma.activeCall.findUnique({ where: { id: singleId } });
      if (!call) throw forbidden("not a party to this call");
      if (auth.userId !== call.callerId && auth.userId !== call.calleeId) throw forbidden("not a party to this call");
      const signals = await prisma.callSignal.findMany({
        where: { callId: singleId, toUserId: auth.userId },
        orderBy: { createdAt: "asc" },
      });
      if (signals.length > 0) {
        await prisma.callSignal.deleteMany({ where: { id: { in: signals.map((s) => s.id) } } });
      }
      const status = call.status === "RINGING" ? "ringing" : call.status === "ACCEPTED" ? "accepted" : call.status;
      return json({
        status,
        callerId: call.callerId, calleeId: call.calleeId, type: call.type,
        signals: signals.map((s) => ({ callId: singleId, kind: s.kind, payload: s.payload })),
      });
    }
    if (params.get("incoming") === "1") {
      const incoming = await prisma.activeCall.findMany({
        where: { calleeId: auth.userId, status: "RINGING" },
        orderBy: { ringingSince: "asc" },
      });
      return json({ incoming: incoming.map((c) => ({ callId: c.id, callerId: c.callerId, type: c.type, chatId: c.chatId })) });
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
      if (await isBlockedEitherDirection(prisma, auth.userId, calleeId)) throw forbidden("you are blocked by this user, or you blocked this user");
      const busy = await prisma.activeCall.findFirst({
        where: { calleeId, status: { in: ["RINGING", "ACCEPTED"] } },
      });
      if (busy) {
        const log = await prisma.callLog.create({
          data: { chatId: typeof body.chatId === "string" ? body.chatId : null, callerId: auth.userId, calleeId, type: type as "AUDIO" | "VIDEO", status: "CANCELLED", startedAt: new Date() },
        });
        return json({ status: "busy", callId: null, callLogId: log.id });
      }
      const id = randomUUID();
      await prisma.activeCall.create({
        data: { id, callerId: auth.userId, calleeId, chatId: typeof body.chatId === "string" ? body.chatId : null, type: type as "AUDIO" | "VIDEO", status: "RINGING" },
      });
      return json({ status: "ringing", callId: id, callLogId: null, calleeId }, 201);
    }

    const call = callId ? await prisma.activeCall.findUnique({ where: { id: callId } }) : null;
    if (action === "signal") {
      if (!call) throw forbidden("not a party to this call");
      if (auth.userId !== call.callerId && auth.userId !== call.calleeId) throw forbidden("not a party to this call");
      if (call.status !== "ACCEPTED") throw forbidden("call not accepted yet — signals are only relayed after accept");
      let signal;
      try {
        signal = validateSignalMessage({ callId, kind: body.kind, payload: body.payload });
      } catch {
        throw badRequest("signal message is invalid");
      }
      const otherId = auth.userId === call.callerId ? call.calleeId : call.callerId;
      await prisma.callSignal.create({
        data: { callId, toUserId: otherId, kind: signal.kind, payload: signal.payload as object },
      });
      return json({ queued: true });
    }
    if (!call) throw forbidden("not a party to this call");
    if (action === "accept") {
      if (auth.userId !== call.calleeId) throw forbidden("only the callee can accept");
      if (call.status !== "RINGING") throw badRequest("this call is no longer ringing");
      const startedAt = new Date();
      const log = await prisma.callLog.create({
        data: { chatId: call.chatId, callerId: call.callerId, calleeId: auth.userId, type: call.type, status: "ACCEPTED", startedAt },
      });
      await prisma.activeCall.update({ where: { id: callId }, data: { status: "ACCEPTED", startedAt, callLogId: log.id } });
      return json({ callLog: log });
    }
    if (action === "decline") {
      if (auth.userId !== call.calleeId) throw forbidden("only the callee can decline");
      const log = await prisma.callLog.create({
        data: { chatId: call.chatId, callerId: call.callerId, calleeId: auth.userId, type: call.type, status: "DECLINED", startedAt: new Date() },
      });
      await prisma.activeCall.update({ where: { id: callId }, data: { status: "DECLINED", callLogId: log.id } });
      return json({ callLog: log });
    }
    if (action === "cancel") {
      if (auth.userId !== call.callerId) throw forbidden("only the caller can cancel an unanswered call");
      if (call.status !== "RINGING") throw badRequest("call already accepted — use end, not cancel");
      const log = await prisma.callLog.create({
        data: { chatId: call.chatId, callerId: call.callerId, calleeId: call.calleeId, type: call.type, status: "CANCELLED", startedAt: call.ringingSince },
      });
      await prisma.activeCall.update({ where: { id: callId }, data: { status: "CANCELLED", callLogId: log.id } });
      return json({ callLog: log });
    }
    if (action === "end") {
      if (auth.userId !== call.callerId && auth.userId !== call.calleeId) throw forbidden("not a party to this call");
      if (call.status !== "ACCEPTED" || call.callLogId === null || call.startedAt === null) throw badRequest("call not accepted yet — caller uses cancel");
      const endedAt = new Date();
      const durationSec = Math.max(0, Math.floor((endedAt.getTime() - call.startedAt.getTime()) / 1000));
      const updated = await prisma.callLog.update({
        where: { id: call.callLogId }, data: { status: "ENDED", endedAt, durationSec },
      });
      await prisma.activeCall.update({ where: { id: callId }, data: { status: "ENDED" } });
      return json({ callLog: updated });
    }
    throw badRequest("call action is invalid");
  } catch (err) {
    return handleError(err);
  }
}
