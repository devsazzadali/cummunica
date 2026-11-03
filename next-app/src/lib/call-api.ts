// Step 4 — client-side calls to our OWN /api/calls routes.
// No third-party calling service is involved at any point.
import type { SignalMessage } from "./webrtc";

function authHeaders(token: string): Record<string, string> {
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

async function callApi(token: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch("/api/calls", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  const data: Record<string, unknown> = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error((data.message as string) || `call request failed (${res.status})`) as Error & { status: number };
    err.status = res.status;
    throw err;
  }
  return data;
}

export interface StartCallResult {
  status: "ringing" | "busy";
  callId: string | null;
  callLogId: string | null;
  calleeId?: string;
}

export async function startCall(
  token: string,
  calleeIdentifier: string,
  type: "AUDIO" | "VIDEO",
): Promise<StartCallResult> {
  const data = await callApi(token, { calleeIdentifier, type });
  return {
    status: data.status as "ringing" | "busy",
    callId: (data.callId as string | null) ?? null,
    callLogId: (data.callLogId as string | null) ?? null,
    calleeId: data.calleeId as string | undefined,
  };
}

export async function callAction(
  token: string,
  action: "accept" | "decline" | "cancel" | "end",
  callId: string,
): Promise<Record<string, unknown>> {
  return callApi(token, { action, callId });
}

/** Queue a signal for the peer (REST fallback transport). The peer
 *  picks it up by polling GET /api/calls?callId=... */
export async function queueSignal(
  token: string,
  callId: string,
  kind: SignalMessage["kind"],
  payload: Record<string, unknown>,
): Promise<void> {
  await callApi(token, { action: "signal", callId, kind, payload });
}

export interface CallStatus {
  status: "ringing" | "accepted" | "DECLINED" | "CANCELLED" | "MISSED" | "ENDED" | "gone";
  callerId?: string;
  calleeId?: string;
  type?: string;
  signals: SignalMessage[];
}

/** Pollable status + pending signals for one call (party only,
 *  enforced server-side). Signals returned here are consumed: the
 *  server clears them once delivered to this party. */
export async function fetchCallStatus(token: string, callId: string): Promise<CallStatus> {
  const res = await fetch(`/api/calls?callId=${encodeURIComponent(callId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data: Record<string, unknown> = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error((data.message as string) || `call status failed (${res.status})`) as Error & { status: number };
    err.status = res.status;
    throw err;
  }
  return {
    status: data.status as CallStatus["status"],
    callerId: data.callerId as string | undefined,
    calleeId: data.calleeId as string | undefined,
    type: data.type as string | undefined,
    signals: (Array.isArray(data.signals) ? data.signals : []) as SignalMessage[],
  };
}

export interface IncomingCall {
  callId: string;
  callerId: string;
  type: string;
  chatId: string | null;
}

/** Ringing calls addressed to the signed-in user (party only). */
export async function fetchIncoming(token: string): Promise<IncomingCall[]> {
  const res = await fetch("/api/calls?incoming=1", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data: Record<string, unknown> = await res.json().catch(() => ({}));
  if (!res.ok) return [];
  return (Array.isArray(data.incoming) ? data.incoming : []) as IncomingCall[];
}

/** Resolve a display name / identifier to a diallable identifier via
 *  our own user search. Returns null when no real user matches — the
 *  UI must then show a gated error, never start a fake call. */
export async function resolveCalleeIdentifier(token: string, query: string): Promise<string | null> {
  const trimmed = query.trim().replace(/^@/, "");
  if (trimmed === "") return null;
  if (/^[0-9]{8}$/.test(trimmed)) return trimmed;
  const res = await fetch(`/api/users/search?q=${encodeURIComponent(trimmed)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) {
    const err = new Error("sign-in expired") as Error & { status: number };
    err.status = 401;
    throw err;
  }
  if (!res.ok) return null;
  const data: Record<string, unknown> = await res.json().catch(() => ({}));
  // BUG FIX (2026-11-03): /api/users/search returns { results: [...] },
  // not { users: [...] }. The old code read data.users, so it was always
  // [] and EVERY username call failed as "Could not find" — even for a
  // real chat partner. Every other search consumer already used results.
  const raw = Array.isArray(data.results) ? data.results : Array.isArray(data.users) ? data.users : [];
  const users = raw;
  const exact = users.find((u) => (u as Record<string, unknown>).username === trimmed.toLowerCase());
  const first = (exact ?? users[0]) as Record<string, unknown> | undefined;
  if (!first || typeof first.username !== "string") return null;
  return first.username;
}

export function readToken(): string | null {
  try {
    return localStorage.getItem("communica_token");
  } catch {
    return null;
  }
}
