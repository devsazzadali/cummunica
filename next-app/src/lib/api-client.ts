// Tiny client for the real API. Token lives in localStorage for now
// (see SECURITY.md: httpOnly-cookie hardening is the follow-up).
// Every helper throws the server's honest message on failure —
// callers must show it, never invent a success.
export function getToken(): string | null {
  try { return localStorage.getItem("communica_token"); } catch { return null; }
}
export async function apiJson(path: string, opts: { method?: string; body?: unknown; form?: FormData } = {}): Promise<unknown> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let body: BodyInit | undefined;
  if (opts.form) body = opts.form;
  else if (opts.body !== undefined) { headers["Content-Type"] = "application/json"; body = JSON.stringify(opts.body); }
  const res = await fetch(path, { method: opts.method ?? "GET", headers, body });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { message?: string }).message ?? `request failed (${res.status})`);
  return data;
}
export type ChatMember = { userId: string; role: string; username: string; displayName: string; communicaId: string };
export type ChatItem = {
  chat: { id: string; type: string; title: string | null; createdAt: string };
  members: ChatMember[];
  lastMessage: { id: string; type: string; text: string | null; senderId: string; createdAt: string } | null;
  lastActivity: string; unread: number; isFavorite: boolean;
};
export function chatTitle(c: ChatItem, meUsername?: string): string {
  if (c.chat.type === "GROUP") return c.chat.title ?? "Group";
  const other = c.members.find((m) => m.username !== meUsername);
  return other ? other.displayName : (c.chat.title ?? "Chat");
}
export type Msg = {
  id: string; chatId: string; senderId: string; type: string; text: string | null;
  mediaUrl: string | null; mediaMime: string | null; durationSec: number | null;
  replyToId: string | null; editedAt: string | null; deletedForAll: boolean; createdAt: string;
  sender?: { username: string; displayName: string };
  reactions?: { emoji: string; userId: string }[];
  reads?: { userId: string }[];
};
export type StatusItem = {
  id: string; userId: string; mediaUrl: string | null; text: string | null;
  expiresAt: string; createdAt: string;
  user?: { username: string; displayName: string; communicaId: string };
  viewers?: { username: string; displayName: string }[];
};
export async function uploadFile(file: File): Promise<{ url: string; mime: string; kind: string }> {
  const form = new FormData();
  form.append("file", file);
  const data = await apiJson("/api/media", { method: "POST", form }) as { url: string; mime: string; kind: string };
  return data;
}
