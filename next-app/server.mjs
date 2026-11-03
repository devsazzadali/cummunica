// Communica — OPTIONAL Socket.io signalling custom server.
//
// Run:  npm run socket        (or: node server.mjs)
// Then open the app on the same port (default 3000).
// The DEFAULT build is unaffected: `npm run build` + `npm start`
// keep working without this server, and the call client then uses
// the /api/calls REST signal queue + polling instead of live relay.
//
// WHAT THIS SERVER DOES (and does not do):
// - Relays WebRTC signalling ONLY (offer / answer / ICE) between the
//   two parties of a call, and pushes call:incoming notifications.
// - NEVER sees media: audio/video stay peer-to-peer WebRTC.
// - NEVER dials a phone number: identifiers are in-app Communica IDs.
// - NO third-party calling service, SDK, or API key is used here.
// - NO TURN server is provisioned: STUN (public STUN, configured in
//   src/lib/webrtc.ts) is the default; strict NATs may need a
//   self-hostable TURN server later.
//
// AUTHORIZATION, honestly stated:
// - The socket handshake JWT is verified with the same JWT_SECRET as
//   the HTTP API; unauthenticated sockets are rejected.
// - The accepted-contact gate itself is enforced by POST /api/calls
//   start (403 unless the callee accepted the caller). This server
//   only relays for a callId a client registered after that REST
//   start, and only between the registered caller/callee pair.
// - Defence in depth on the client: on receiving a socket
//   call:incoming, the callee re-verifies the call via
//   GET /api/calls?callId=... (server-side party + active check)
//   before showing any accept UI, so a forged socket push for a
//   call the REST route never created is ignored.
// - CallLog rows are written ONLY by the /api/calls routes, never
//   here, so there is exactly one log authority.
//
// SINGLE-PROCESS LIMITATION: the registry below is in-memory, like
// the /api/calls active-call map. A multi-instance deployment must
// move this to shared state (e.g. Redis) or pin a user's signalling
// to one instance — otherwise busy checks and relay diverge.

import http from "node:http";
import next from "next";
import { Server as SocketServer } from "socket.io";
import jwt from "jsonwebtoken";

const dev = process.env.NODE_ENV !== "production";
const port = Number(process.env.PORT ?? 3000);
const RINGING_TIMEOUT_MS = 30 * 1000;

const app = next({ dev });
const handle = app.getRequestHandler();

function verifyUserId(token) {
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;
  try {
    const decoded = jwt.verify(token, secret);
    return typeof decoded?.userId === "string" ? decoded.userId : null;
  } catch {
    return null;
  }
}

function validSignal(msg) {
  if (!msg || typeof msg !== "object") return false;
  if (typeof msg.callId !== "string" || msg.callId === "") return false;
  if (!["offer", "answer", "ice"].includes(msg.kind)) return false;
  if (!msg.payload || typeof msg.payload !== "object" || Array.isArray(msg.payload)) return false;
  if ((msg.kind === "offer" || msg.kind === "answer") && typeof msg.payload.sdp !== "string") return false;
  if (msg.kind === "ice" && !("candidate" in msg.payload)) return false;
  return true;
}

await app.prepare();
const httpServer = http.createServer((req, res) => void handle(req, res));
const io = new SocketServer(httpServer, { cors: { origin: true, credentials: true } });

/** callId -> { callerId, calleeId, timer } */
const registry = new Map();

io.use((socket, nextFn) => {
  const token = socket.handshake?.auth?.token;
  const userId = typeof token === "string" ? verifyUserId(token) : null;
  if (!userId) return nextFn(new Error("unauthenticated"));
  socket.data.userId = userId;
  return nextFn();
});

io.on("connection", (socket) => {
  const userId = socket.data.userId;
  socket.join(`user:${userId}`);

  // Caller bookkeeping after a successful POST /api/calls start.
  socket.on("call:register", (msg) => {
    if (!msg || typeof msg.callId !== "string" || typeof msg.calleeId !== "string") return;
    if (registry.has(msg.callId)) return;
    const timer = setTimeout(() => registry.delete(msg.callId), RINGING_TIMEOUT_MS);
    registry.set(msg.callId, { callerId: userId, calleeId: msg.calleeId, timer });
  });

  // Caller asks the server to push an incoming-call notice to the callee.
  socket.on("call:notify", (msg) => {
    const entry = msg && registry.get(msg.callId);
    if (!entry || entry.callerId !== userId) return;
    if (msg.type !== "AUDIO" && msg.type !== "VIDEO") return;
    io.to(`user:${entry.calleeId}`).emit("call:incoming", {
      callId: msg.callId, callerId: userId, type: msg.type,
    });
  });

  // Live relay of one signal to the other party only.
  socket.on("call:signal", (msg) => {
    if (!validSignal(msg)) {
      socket.emit("error", { code: "bad_request", message: "signal message is invalid" });
      return;
    }
    const entry = registry.get(msg.callId);
    if (!entry || (entry.callerId !== userId && entry.calleeId !== userId)) {
      socket.emit("error", { code: "forbidden", message: "not a party to this call" });
      return;
    }
    const otherId = userId === entry.callerId ? entry.calleeId : entry.callerId;
    io.to(`user:${otherId}`).emit("call:signal", {
      callId: msg.callId, kind: msg.kind, payload: msg.payload, from: userId,
    });
  });

  socket.on("call:unregister", (msg) => {
    const entry = msg && registry.get(msg.callId);
    if (entry && (entry.callerId === userId || entry.calleeId === userId)) {
      clearTimeout(entry.timer);
      registry.delete(msg.callId);
    }
  });
});

httpServer.listen(port, () => {
  console.log(`Communica (Next + Socket.io signalling) on http://localhost:${port}`);
});
