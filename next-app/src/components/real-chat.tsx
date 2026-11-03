"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Phone, Video, Send, Paperclip, Mic, Star, Heart, MoreVertical, Smile, Camera } from "lucide-react";
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [chatSearch, setChatSearch] = useState("");
  const [showMedia, setShowMedia] = useState(false);
  const [contactMsg, setContactMsg] = useState("");
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
  const addContact = async () => {
    if (!other) return;
    try { await apiJson("/api/contacts", { method: "POST", body: { identifier: other.username } }); setContactMsg("Contact request sent — the other user must accept it before calls are allowed."); } catch (err) { setContactMsg(err instanceof Error ? err.message : "could not add contact"); }
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
  const displayMsgs = chatSearch.trim() === "" ? msgs : msgs.filter((m) => (m.text ?? "").toLowerCase().includes(chatSearch.trim().toLowerCase()));
  const msgsWithDate = displayMsgs.map((m, i) => ({ m, showDate: i === 0 || new Date(displayMsgs[i - 1].createdAt).toDateString() !== new Date(m.createdAt).toDateString() }));
  return <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
    <header className="topbar">
      <Link className="icon-btn" href="/chats" aria-label="Back"><ArrowLeft size={22} /></Link>
      <Avatar name={name} group={group} />
      <h1>{name}{chat?.members.length ? ` · ${chat.members.length} member${chat.members.length > 1 ? "s" : ""}` : ""}</h1>
      <div className="topbar-actions">
        {other ? <><Link className="icon-btn" href={`/call?to=${encodeURIComponent(other.displayName)}&callee=${other.username}&kind=audio&variant=outgoing`} aria-label="Audio call"><Phone size={22} /></Link><Link className="icon-btn" href={`/call?to=${encodeURIComponent(other.displayName)}&callee=${other.username}&kind=video&variant=outgoing`} aria-label="Video call"><Video size={22} /></Link></> : null}
        <div className="chat-menu-wrap"><button type="button" className="icon-btn" aria-label="More options" onClick={() => setMenuOpen(!menuOpen)}><MoreVertical size={22} /></button>{menuOpen ? <div className="chat-menu"><Link href="/new-group" onClick={() => setMenuOpen(false)}>New group</Link>{other ? <button type="button" onClick={() => { setMenuOpen(false); void addContact(); }}>Add to contacts</button> : null}<button type="button" onClick={() => { setMenuOpen(false); setShowMedia(false); setShowSearch(!showSearch); }}>Search in chat</button><button type="button" onClick={() => { setMenuOpen(false); setShowSearch(false); setShowMedia(!showMedia); }}>Media, links, and docs</button><Link href="/settings" onClick={() => setMenuOpen(false)}>Chat theme</Link>{other ? <Link href={`/contacts/${other.username}`} onClick={() => setMenuOpen(false)}>View contact</Link> : null}{group ? <Link href={`/groups/${chatId}/info`} onClick={() => setMenuOpen(false)}>Group info</Link> : null}<button type="button" onClick={() => { setMenuOpen(false); void favChat(); }}>Favourite</button><button type="button" onClick={() => { setMenuOpen(false); void archiveChat(true); }}>Archive</button>{other ? <button type="button" onClick={() => { setMenuOpen(false); void blockChat(); }}>Block</button> : null}</div> : null}</div>
      </div>
    </header>
    <div className="chat-view">{contactMsg ? <p className="chat-panel" role="status">{contactMsg}</p> : null}{showSearch ? <div className="chat-panel"><input value={chatSearch} onChange={(e) => setChatSearch(e.target.value)} placeholder="Search in this chat…" aria-label="Search in this chat" /><button type="button" className="btn btn-light" onClick={() => { setChatSearch(""); setShowSearch(false); }}>Close</button>{chatSearch.trim() !== "" ? <span>{displayMsgs.length} match{displayMsgs.length === 1 ? "" : "es"} in loaded messages</span> : null}</div> : null}{showMedia ? <div className="chat-panel"><h3>Media</h3>{msgs.filter((m) => m.mediaUrl).length ? <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{msgs.filter((m) => m.mediaUrl).map((m) => (<span key={m.id}>{m.type === "PHOTO" && m.mediaUrl ? <img src={m.mediaUrl} alt="Shared photo" style={{ width: 96, height: 96, objectFit: "cover", borderRadius: 8 }} /> : m.type === "VIDEO" && m.mediaUrl ? <video src={m.mediaUrl} style={{ width: 120, borderRadius: 8 }} controls /> : m.type === "VOICE" && m.mediaUrl ? <audio src={m.mediaUrl} controls style={{ maxWidth: 200 }} /> : null}</span>))}</div> : <p>No media shared yet.</p>}<h3>Links</h3>{(() => { const links: string[] = []; msgs.forEach((m) => { const found = (m.text ?? "").match(/https?:\/\/[^\s]+/g); if (found) links.push(...found); }); return links.length ? <ul>{links.map((u, i) => (<li key={i}><a href={u} target="_blank" rel="noreferrer">{u}</a></li>))}</ul> : <p>No links shared yet.</p>; })()}<h3>Docs</h3><p>No documents shared yet — Communica messages support photos, voice and video only.</p><button type="button" className="btn btn-light" onClick={() => setShowMedia(false)}>Close</button></div> : null}<div className="chat-bg">
      {msgsWithDate.map(({ m, showDate }) => {
        const mine = m.senderId === myId;
        const senderName = m.sender?.displayName ?? (mine ? "You" : "");
        return <div key={m.id} style={{ display: "contents" }}>{showDate ? <div className="date-pill"><span>{new Date(m.createdAt).toLocaleDateString([], { year: "numeric", month: "long", day: "numeric" })}</span></div> : null}<div className={mine ? "bubble bubble-me" : "bubble bubble-other"} onClick={() => setSelectedId(selectedId === m.id ? null : m.id)}>
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
          {!m.deletedForAll && selectedId === m.id ? <span className="msg-actions">
            <button type="button" className="btn btn-light" style={{ minHeight: 44, padding: "10px 14px" }} onClick={() => setReplyTo(m)}>Reply</button>
            <button type="button" className="btn btn-light" style={{ minHeight: 44, padding: "10px 14px" }} onClick={() => void react(m, "❤️")} aria-label="React with heart"><Heart size={16} /></button>
            {mine && m.type === "TEXT" ? <button type="button" className="btn btn-light" style={{ minHeight: 44, padding: "10px 14px" }} onClick={() => { setEditing(m); setEditText(m.text ?? ""); }}>Edit</button> : null}
            {mine ? <button type="button" className="btn btn-light" style={{ minHeight: 44, padding: "10px 14px" }} onClick={() => void deleteForAll(m)}>Delete for all</button> : null}
          </span> : null}
        </div></div>;
      })}
      {error !== "" ? <p role="alert">{error}</p> : null}
      {replyTo ? <p>Replying to: {replyTo.text ?? replyTo.type} <button type="button" className="btn btn-light" onClick={() => setReplyTo(null)}>Cancel</button></p> : null}
      {editing ? <p><input value={editText} onChange={(e) => setEditText(e.target.value)} aria-label="Edited message" /><button type="button" className="btn btn-green" onClick={() => void saveEdit()}>Save edit</button> <button type="button" className="btn btn-light" onClick={() => setEditing(null)}>Cancel</button></p> : null}
      <p className="ai-label">Messages refresh every 3 seconds (polling). Live Socket.io chat relay is not built — calls use Socket.io signalling; chat delivery is API + polling, honestly labelled.</p>
    </div>
    {emojiOpen ? <div className="emoji-picker">{["😊", "❤️", "👍", "😂", "🙏", "🎉", "😢", "🔥", "👋", "✅", "🌸", "🙌"].map((e) => (<button key={e} type="button" aria-label="Insert emoji" onClick={() => { setText(text + e); setEmojiOpen(false); }}>{e}</button>))}</div> : null}
    <form className="composer" onSubmit={send}>
      <label style={{ display: "none" }} htmlFor="chat-photo">Attach photo</label>
      <input id="chat-photo" type="file" accept="image/jpeg,image/png,image/webp,image/gif" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) void sendMedia(f); e.target.value = ""; }} />
      <input id="chat-camera" type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) void sendMedia(f); e.target.value = ""; }} />
      <button type="button" className="icon-btn" aria-label="Emoji" onClick={() => setEmojiOpen(!emojiOpen)}><Smile size={22} /></button>
      <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Message…" aria-label="Message" />
      <button type="button" className="icon-btn" aria-label="Attach photo" onClick={() => document.getElementById("chat-photo")?.click()}><Paperclip size={22} /></button>
      <button type="button" className="icon-btn" aria-label="Camera" onClick={() => document.getElementById("chat-camera")?.click()}><Camera size={22} /></button>
      {text.trim() === "" ? <button type="button" className="icon-btn" aria-label={recording ? "Stop voice recording" : "Record voice message"} onClick={() => void toggleRecord()}><Mic size={22} />{recording ? "Stop" : ""}</button> : <button type="submit" className="icon-btn icon-btn-send" aria-label="Send" disabled={busy}><Send size={22} /></button>}
    </form></div>
  </div>;
}
