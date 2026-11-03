"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Phone, Video, Info, Send, Paperclip, Mic, Star, Archive, Ban, Heart } from "lucide-react";
import { Avatar, Ticks } from "@/components/ui";
import { apiJson, chatTitle, getToken, uploadFile, type ChatItem, type Msg } from "@/lib/api-client";

function fmt(t: string): string {
  try { return new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); } catch { return t; }
}
function meUsername(): string {
  try { const u = JSON.parse(localStorage.getItem("communica_user") ?? "{}"); return u.username ?? ""; } catch { return ""; }
}

export function RealChatList({ filter, archived, activeId, q }: { filter?: "all" | "unread" | "favorites" | "groups"; archived?: boolean; activeId?: string; q?: string }) {
  const [chats, setChats] = useState<ChatItem[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const f = filter === "favorites" ? "favorites" : filter === "unread" ? "unread" : filter === "groups" ? "groups" : "all";
        const data = await apiJson(`/api/chats?filter=${f}${archived ? "&archived=true" : ""}`) as { chats: ChatItem[] };
        if (!cancelled) setChats(data.chats);
      } catch (err) { if (!cancelled) setError(err instanceof Error ? err.message : "failed to load chats"); }
    })();
    return () => { cancelled = true; };
  }, [filter, archived]);
  if (error !== "") return <div className="wrap"><p role="alert">Could not load chats: {error}</p>{getToken() ? null : <p><Link className="btn btn-green" href="/login">Login</Link></p>}</div>;
  if (chats === null) return <p className="empty">Loading chats…</p>;
  if (!chats.length) return <p className="empty">No chats here yet. Search for someone to start a real chat.</p>;
  const me = meUsername();
  const query = (q ?? "").trim().toLowerCase();
  const visible = query ? chats.filter((c) => {
    const name = chatTitle(c, me).toLowerCase();
    const preview = (c.lastMessage?.text ?? "").toLowerCase();
    const members = c.members.map((m) => `${m.displayName} ${m.username}`.toLowerCase()).join(" ");
    return name.includes(query) || preview.includes(query) || members.includes(query);
  }) : chats;
  if (!visible.length) return <p className="empty">No chats match “{q}”.</p>;
  return <div className="chat-list">{visible.map((c) => {
    const href = c.chat.type === "GROUP" ? `/groups/${c.chat.id}` : `/chats/${c.chat.id}`;
    const name = chatTitle(c, me);
    return <div key={c.chat.id} className={activeId === c.chat.id ? "chat-row-wrap chat-row-active" : "chat-row-wrap"}>
      <Link className="chat-row" href={href}>
        <Avatar name={name} group={c.chat.type === "GROUP"} />
        <span className="chat-row-main"><span className="chat-row-top"><strong>{name}</strong><span className="chat-time">{c.lastMessage ? fmt(c.lastMessage.createdAt) : ""}</span></span>
        <span className="chat-row-bottom"><span className="chat-preview">{c.lastMessage?.text ?? (c.lastMessage ? `${c.lastMessage.type} message` : "No messages yet")}</span>{c.unread > 0 ? <span className="unread-badge">{c.unread}</span> : null}{c.isFavorite ? <Star size={14} className="fav-star" aria-label="Favorite" /> : null}</span></span>
      </Link></div>;
  })}</div>;
}

export function RealChat({ chatId, group }: { chatId: string; group: boolean }) {
  const [chat, setChat] = useState<ChatItem | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<Msg | null>(null);
  const [editing, setEditing] = useState<Msg | null>(null);
  const [editText, setEditText] = useState("");
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [myId, setMyId] = useState("");
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const sinceRef = useRef<string>("");

  const loadChat = useCallback(async () => {
    const data = await apiJson("/api/chats") as { chats: ChatItem[] };
    const found = data.chats.find((c) => c.chat.id === chatId) ?? null;
    if (!found) throw new Error("chat not found or you are not a member");
    setChat(found);
  }, [chatId]);
  const loadMsgs = useCallback(async (since?: string) => {
    const q = since ? `?chatId=${chatId}&since=${encodeURIComponent(since)}` : `?chatId=${chatId}&limit=50`;
    const data = await apiJson(`/api/messages${q}`) as { messages: Msg[] };
    if (since) {
      if (data.messages.length) setMsgs((prev) => [...prev, ...data.messages.filter((m) => !prev.some((p) => p.id === m.id))]);
    } else {
      setMsgs([...data.messages].reverse());
      const last = data.messages[0];
      if (last) sinceRef.current = last.createdAt;
    }
    return data.messages;
  }, [chatId]);

  useEffect(() => {
    try { const u = JSON.parse(localStorage.getItem("communica_user") ?? "{}"); setMyId(u.id ?? ""); } catch {}
    let cancelled = false;
    (async () => {
      try { await loadChat(); const first = await loadMsgs(); if (!cancelled && first.length) {
        // Mark the newest message from others as read (read receipt).
        const other = [...first].reverse().find((m) => m.senderId !== myId);
        if (other) { try { await apiJson("/api/messages", { method: "POST", body: { chatId, action: "read", messageId: other.id } }); } catch {} }
      } } catch (err) { if (!cancelled) setError(err instanceof Error ? err.message : "failed to load chat"); }
    })();
    const timer = setInterval(() => { loadMsgs(sinceRef.current || undefined).then((arr) => { if (arr.length) sinceRef.current = arr[arr.length - 1].createdAt; }).catch(() => {}); }, 3000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [chatId, loadChat, loadMsgs, myId]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault(); setError("");
    const value = text.trim(); if (value === "" || busy) return; setBusy(true);
    try {
      const data = await apiJson("/api/messages", { method: "POST", body: { chatId, text: value, type: "TEXT", replyToId: replyTo?.id ?? null } }) as { message: Msg };
      setMsgs((prev) => [...prev, data.message]); setText(""); setReplyTo(null); sinceRef.current = data.message.createdAt;
    } catch (err) { setError(err instanceof Error ? err.message : "send failed — message was not sent"); }
    setBusy(false);
  };
  const sendMedia = async (file: File) => {
    setError("");
    try {
      const up = await uploadFile(file);
      const data = await apiJson("/api/messages", { method: "POST", body: { chatId, type: up.kind, mediaUrl: up.url, mediaMime: up.mime } }) as { message: Msg };
      setMsgs((prev) => [...prev, data.message]); sinceRef.current = data.message.createdAt;
    } catch (err) { setError(err instanceof Error ? err.message : "media send failed — file was not sent as a message"); }
  };
  const toggleRecord = async () => {
    if (recording) { recRef.current?.stop(); setRecording(false); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (ev) => { if (ev.data.size) chunksRef.current.push(ev.data); };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        if (blob.size) void sendMedia(new File([blob], "voice.webm", { type: blob.type }));
      };
      recRef.current = rec; rec.start(); setRecording(true);
    } catch { setError("Microphone permission denied — voice message was not recorded."); }
  };
  const react = async (m: Msg, emoji: string) => {
    try { await apiJson("/api/reactions", { method: "POST", body: { chatId, messageId: m.id, emoji } }); void loadMsgs(); } catch (err) { setError(err instanceof Error ? err.message : "reaction failed"); }
  };
  const saveEdit = async () => {
    if (!editing) return;
    try {
      const data = await apiJson("/api/messages", { method: "PATCH", body: { chatId, messageId: editing.id, text: editText } }) as { message: Msg };
      setMsgs((prev) => prev.map((m) => (m.id === data.message.id ? { ...m, text: data.message.text, editedAt: data.message.editedAt } : m)));
      setEditing(null);
    } catch (err) { setError(err instanceof Error ? err.message : "edit failed"); }
  };
  const deleteForAll = async (m: Msg) => {
    try {
      await apiJson(`/api/messages?chatId=${chatId}&messageId=${m.id}`, { method: "DELETE" });
      setMsgs((prev) => prev.map((x) => (x.id === m.id ? { ...x, deletedForAll: true, text: null, mediaUrl: null } : x)));
    } catch (err) { setError(err instanceof Error ? err.message : "delete failed"); }
  };
  const archiveChat = async (archived: boolean) => {
    try { await apiJson("/api/chats", { method: "PATCH", body: { chatId, archived } }); } catch (err) { setError(err instanceof Error ? err.message : "archive failed"); }
  };
  const favChat = async () => {
    try {
      const other = chat?.members.find((m) => m.userId !== myId);
      if (!other) throw new Error("favourites apply to direct chats");
      await apiJson("/api/contacts", { method: "POST", body: { identifier: other.username } }).catch(() => {});
      await apiJson("/api/contacts", { method: "PATCH", body: { identifier: other.username, isFavorite: true } });
    } catch (err) { setError(err instanceof Error ? err.message : "favourite failed"); }
  };
  const blockChat = async () => {
    try {
      const other = chat?.members.find((m) => m.userId !== myId);
      if (!other) throw new Error("blocking applies to direct chats");
      await apiJson("/api/contacts", { method: "POST", body: { identifier: other.username } }).catch(() => {});
      await apiJson("/api/contacts", { method: "PATCH", body: { identifier: other.username, isBlocked: true } });
      setError("Contact blocked. New messages from this contact are refused by the server.");
    } catch (err) { setError(err instanceof Error ? err.message : "block failed"); }
  };

  if (error !== "" && chat === null) return <div className="wrap"><p role="alert">{error}</p><p><Link className="btn btn-green" href="/login">Login</Link> <Link className="btn btn-light" href="/chats">Back to Chats</Link></p></div>;
  const me = meUsername();
  const name = chat ? chatTitle(chat, me) : "Chat";
  const other = chat?.members.find((m) => m.userId !== myId);
  return <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
    <header className="topbar">
      <Link className="icon-btn" href="/chats" aria-label="Back"><ArrowLeft size={22} /></Link>
      <Avatar name={name} group={group} />
      <h1>{name}{chat?.members.length ? ` · ${chat.members.length} member${chat.members.length > 1 ? "s" : ""}` : ""}</h1>
      <div className="topbar-actions">
        {other ? <><Link className="icon-btn" href={`/call?to=${encodeURIComponent(other.displayName)}&callee=${other.username}&kind=audio&variant=outgoing`} aria-label="Audio call"><Phone size={22} /></Link><Link className="icon-btn" href={`/call?to=${encodeURIComponent(other.displayName)}&callee=${other.username}&kind=video&variant=outgoing`} aria-label="Video call"><Video size={22} /></Link><Link className="icon-btn" href={`/contacts/${other.username}`} aria-label="Profile"><Info size={22} /></Link></> : null}
        {group ? <Link className="icon-btn" href={`/groups/${chatId}/info`} aria-label="Group info"><Info size={22} /></Link> : null}
      </div>
    </header>
    <div className="chat-view"><div className="chat-bg">
      {msgs.map((m) => {
        const mine = m.senderId === myId;
        const senderName = m.sender?.displayName ?? (mine ? "You" : "");
        return <div key={m.id} className={mine ? "bubble bubble-me" : "bubble bubble-other"}>
          {group && !mine ? <span className="bubble-sender">{senderName}</span> : null}
          {m.deletedForAll ? <span><em>This message was deleted</em></span> : <>
            {m.replyToId ? <span style={{ fontSize: 13, opacity: 0.8 }}>Replying to a message</span> : null}
            {m.type === "PHOTO" && m.mediaUrl ? <><img src={m.mediaUrl} alt="Shared photo" style={{ maxWidth: "100%", borderRadius: 8 }} /><br /></> : null}
            {m.type === "VOICE" && m.mediaUrl ? <><audio controls src={m.mediaUrl} style={{ maxWidth: "100%" }} /><br /></> : null}
            {m.type === "VIDEO" && m.mediaUrl ? <><video controls src={m.mediaUrl} style={{ maxWidth: "100%" }} /><br /></> : null}
            <span>{m.text}</span>
          </>}
          <span className="bubble-meta">{fmt(m.createdAt)}{m.editedAt ? " · edited" : ""} {mine ? <Ticks status={(m.reads?.length ?? 0) > 0 ? "read" : "delivered"} /> : null}</span>
          {(m.reactions?.length ?? 0) > 0 ? <span style={{ fontSize: 13 }}>{m.reactions!.map((r) => r.emoji).join(" ")}</span> : null}
          {!m.deletedForAll ? <span style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
            <button type="button" className="btn btn-light" style={{ minHeight: 44, padding: "10px 14px" }} onClick={() => setReplyTo(m)}>Reply</button>
            <button type="button" className="btn btn-light" style={{ minHeight: 44, padding: "10px 14px" }} onClick={() => void react(m, "❤️")} aria-label="React with heart"><Heart size={16} /></button>
            {mine && m.type === "TEXT" ? <button type="button" className="btn btn-light" style={{ minHeight: 44, padding: "10px 14px" }} onClick={() => { setEditing(m); setEditText(m.text ?? ""); }}>Edit</button> : null}
            {mine ? <button type="button" className="btn btn-light" style={{ minHeight: 44, padding: "10px 14px" }} onClick={() => void deleteForAll(m)}>Delete for all</button> : null}
          </span> : null}
        </div>;
      })}
      {error !== "" ? <p role="alert">{error}</p> : null}
      {replyTo ? <p>Replying to: {replyTo.text ?? replyTo.type} <button type="button" className="btn btn-light" onClick={() => setReplyTo(null)}>Cancel</button></p> : null}
      {editing ? <p><input value={editText} onChange={(e) => setEditText(e.target.value)} aria-label="Edited message" /><button type="button" className="btn btn-green" onClick={() => void saveEdit()}>Save edit</button> <button type="button" className="btn btn-light" onClick={() => setEditing(null)}>Cancel</button></p> : null}
      <p style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" className="btn btn-light" onClick={() => void favChat()}><Star size={22} /> Favourite</button>
        <button type="button" className="btn btn-light" onClick={() => void archiveChat(true)}><Archive size={22} /> Archive</button>
        {other ? <button type="button" className="btn btn-light" onClick={() => void blockChat()}><Ban size={22} /> Block</button> : null}
      </p>
      <p className="ai-label">Messages refresh every 3 seconds (polling). Live Socket.io chat relay is not built — calls use Socket.io signalling; chat delivery is API + polling, honestly labelled.</p>
    </div>
    <form className="composer" onSubmit={send}>
      <label style={{ display: "none" }} htmlFor="chat-photo">Attach photo</label>
      <input id="chat-photo" type="file" accept="image/jpeg,image/png,image/webp,image/gif" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) void sendMedia(f); e.target.value = ""; }} />
      <button type="button" className="icon-btn" aria-label="Attach photo" onClick={() => document.getElementById("chat-photo")?.click()}><Paperclip size={22} /></button>
      <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Message…" aria-label="Message" />
      <button type="button" className="icon-btn" aria-label={recording ? "Stop voice recording" : "Record voice message"} onClick={() => void toggleRecord()}><Mic size={22} />{recording ? "Stop" : ""}</button>
      <button type="submit" className="icon-btn icon-btn-send" aria-label="Send" disabled={busy}><Send size={22} /></button>
    </form></div>
  </div>;
}
