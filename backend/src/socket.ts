// Communica backend — Socket.io wiring (Step 7 skeleton).
// Rooms and events (ALGORITHMS §4, §7, §8):
//   chat:{chatId}  — message:new, message:read, message:edited,
//                    message:deleted, message:reaction,
//                    group:member-added, group:member-removed,
//                    group:member-left
//   user:{userId}  — call:incoming, call:accepted, call:declined,
//                    call:cancelled, call:missed, call:ended,
//                    call:signal, group:added, group:deleted
//
// SKELETON DESIGN: this file never imports socket.io. Production
// passes a minimal IoLike adapter (implemented over a real Socket.io
// server) so these skeletons type-check with no node_modules and the
// event contract stays testable. The adapter is the ONLY place that
// touches the Socket.io library.
//
// AUTH: the JWT is verified on the socket handshake (same JWT_SECRET
// as the HTTP API, server-side only). An unauthenticated socket joins
// no rooms. A socket joins chat:{chatId} ONLY after a membership
// check — joining a room must never bypass the HTTP membership rules.
//
// POLLING FALLBACK (ALGORITHMS §4): when the socket is down, the
// client polls GET /chats/:chatId/messages?since=<ISO time> on
// reconnect and then every 15 seconds, and stops polling once the
// socket reconnects. Nothing is lost while offline because messages
// are saved in the database first (messages.ts).

import type { TokenSigner } from "./types";
import { forbidden, unauthenticated } from "./errors";

/** Minimal Socket.io-like surface the skeleton needs. Production
 *  implements this over `socket.io`; nothing else here knows the
 *  library. `emitToRoom` is the same shape as EmitFn in types.ts. */
export interface IoLike {
  /** Register a handler invoked for each new socket connection. */
  onConnection(handler: (socket: SocketLike) => void): void;
  emitToRoom(room: string, event: string, payload: unknown): void;
}

export interface SocketLike {
  /** Auth data attached by the handshake (null when unauthenticated). */
  userId: string | null;
  join(room: string): void;
  leave(room: string): void;
  /** Register a handler for a client-emitted event on this socket. */
  on(event: string, handler: (payload: unknown) => void): void;
  emit(event: string, payload: unknown): void;
  disconnect(): void;
}

/** Narrow Db surface this module needs (production: Prisma Client). */
export interface SocketDb {
  isChatMember(chatId: string, userId: string): Promise<boolean>;
  updateLastSeen(userId: string, at: Date): Promise<void>;
}

export interface SocketServiceDeps {
  io: IoLike;
  db: SocketDb;
  signer: TokenSigner;
  /** Called when a client asks to join a chat room; defaults to the
   *  membership check below. */
  now?: () => Date;
}

/**
 * Wire Socket.io authentication + room joining. Call once at server
 * start. Returns nothing; connection handling is registered on `io`.
 *
 * SKELETON LIMITS (production must add before launch):
 * - No per-socket rate limiting or message-size caps here.
 * - No presence broadcast beyond lastSeenAt updates on connect /
 *   disconnect (a "typing…" / online indicator is a later phase).
 * - Reconnection is handled by Socket.io itself; the client then
 *   re-polls (see header) to catch anything missed while offline.
 */
export function wireSocketService(deps: SocketServiceDeps): void {
  const now = deps.now ?? (() => new Date());
  deps.io.onConnection((socket) => {
    // Handshake auth: the client sends its JWT as `auth.token`.
    // The adapter must set socket.userId from a verified token BEFORE
    // this handler runs; a socket with no userId is disconnected here
    // rather than allowed to sit unauthenticated in any room.
    if (socket.userId === null) {
      socket.disconnect();
      return;
    }
    const userId = socket.userId;
    void deps.db.updateLastSeen(userId, now()).catch(() => undefined);
    // Every user always joins their own room for call + group events.
    socket.join(`user:${userId}`);

    socket.on("chat:join", (payload) => {
      const chatId = readChatId(payload);
      if (chatId === null) return;
      void deps.db.isChatMember(chatId, userId).then((isMember) => {
        if (isMember) socket.join(`chat:${chatId}`);
        else socket.emit("error", { code: "forbidden", message: "not a member of this chat" });
      }).catch(() => undefined);
    });

    socket.on("chat:leave", (payload) => {
      const chatId = readChatId(payload);
      if (chatId !== null) socket.leave(`chat:${chatId}`);
    });

    // Signalling and message events are emitted by the service modules
    // (calls.ts, messages.ts, chats.ts) via emitToRoom — clients do NOT
    // broadcast directly through sockets, so a client can never forge
    // a message:read, call:accepted, or group event for a room it is
    // not authorised for. Any other client event is ignored here.
  });
}

function readChatId(payload: unknown): string | null {
  if (typeof payload === "object" && payload !== null && "chatId" in payload) {
    const chatId = (payload as { chatId: unknown }).chatId;
    return typeof chatId === "string" && chatId !== "" ? chatId : null;
  }
  return null;
}

/** Verify a handshake token and return the userId (AUTH, §4/§7).
 *  Throws 401 when the token is missing, expired, or invalid. */
export function authenticateSocket(
  signer: TokenSigner,
  token: string | undefined | null,
): string {
  if (token === undefined || token === null || token === "") {
    throw unauthenticated();
  }
  try {
    return signer.verify(token).userId;
  } catch {
    throw unauthenticated();
  }
}

/** Guard helper for route layers: a socket may only join a chat room
 *  it is a member of. Throws 403 otherwise. */
export async function assertCanJoinChatRoom(
  db: SocketDb,
  userId: string,
  chatId: string,
): Promise<void> {
  if (!(await db.isChatMember(chatId, userId))) {
    throw forbidden("not a member of this chat");
  }
}

/** Full event catalogue (single place, so clients and servers agree). */
export const SOCKET_EVENTS = {
  chatRoom: (chatId: string): string => `chat:${chatId}`,
  userRoom: (userId: string): string => `user:${userId}`,
  messageNew: "message:new",
  messageRead: "message:read",
  messageEdited: "message:edited",
  messageDeleted: "message:deleted",
  messageReaction: "message:reaction",
  callIncoming: "call:incoming",
  callAccepted: "call:accepted",
  callDeclined: "call:declined",
  callCancelled: "call:cancelled",
  callMissed: "call:missed",
  callEnded: "call:ended",
  callSignal: "call:signal",
  groupAdded: "group:added",
  groupMemberAdded: "group:member-added",
  groupMemberRemoved: "group:member-removed",
  groupMemberLeft: "group:member-left",
  groupDeleted: "group:deleted",
} as const;
