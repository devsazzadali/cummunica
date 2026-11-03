"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Phone, Video, Send, Paperclip, Mic, Star, Heart, MoreVertical, Smile, Camera, File as FileIcon, Image as ImageIcon, X, Play, Pause } from "lucide-react";
import { Avatar, Ticks } from "@/components/ui";
import { apiJson, chatTitle, getToken, uploadFile, type ChatItem, type Msg } from "@/lib/api-client";
import { playSendSound, playReceiveSound, notifyMessage } from "@/lib/sound";

function fmt(t: string): string {
  try { return new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); } catch { return t; }
}
function meUsername(): string {
  try { const u = JSON.parse(localStorage.getItem("communica_user") ?? "{}"); return u.username ?? ""; } catch { return ""; }
}


function fmtVoice(sec: number): string {
  if (!isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60); const r = Math.floor(sec % 60);
  return `${m}:${r.toString().padStart(2, "0")}`;
}
function VoicePlayer({ src, fallbackSec }: { src: string; fallbackSec: number | null }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState<number>(fallbackSec ?? 0);
  const [err, setErr] = useState(false);
  const fixedRef = useRef(false);
  const onMeta = () => {
    const a = audioRef.current; if (!a) return;
    // MediaRecorder WebM often reports duration Infinity/0 in Chrome.
    // Seek-to-end trick forces the browser to compute the real duration.
    if (!isFinite(a.duration) && !fixedRef.current) {
      fixedRef.current = true;
      try { a.currentTime = 1e7; } catch {}
      return;
    }
    if (isFinite(a.duration) && a.duration > 0) {
      if (fixedRef.current) { try { a.currentTime = 0; a.pause(); setPlaying(false); } catch {} }
      setDur(a.duration);
    }
  };
  if (err) return <span>Voice could not be played. <a href={src} target="_blank" rel="noreferrer">Download voice</a></span>;
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 8, maxWidth: "100%" }}>
    <button type="button" className="icon-btn" aria-label={playing ? "Pause voice" : "Play voice"} onClick={async () => { const a = audioRef.current; if (!a) return; if (playing) { a.pause(); setPlaying(false); } else { try { await a.play(); setPlaying(true); } catch { setErr(true); } } }}>{playing ? <Pause size={20} /> : <Play size={20} />}</button>
    <span style={{ flex: 1, minWidth: 80, height: 6, background: "rgba(0,0,0,0.15)", borderRadius: 3, overflow: "hidden" }}><span style={{ display: "block", height: "100%", width: dur > 0 ? `${Math.min(100, (cur / dur) * 100)}%` : "0%", background: "var(--t-accent, #5B21B6)" }} /></span>
    <span style={{ fontSize: 13, whiteSpace: "nowrap" }}>{fmtVoice(cur)} / {fmtVoice(dur)}</span>
    <audio ref={audioRef} src={src} preload="metadata" style={{ display: "none" }}
      onLoadedMetadata={onMeta} onDurationChange={onMeta} onTimeUpdate={() => { const a = audioRef.current; if (a) setCur(a.currentTime); }}
      onEnded={() => setPlaying(false)} onError={() => setErr(true)} />
  </span>;
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
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const camStreamRef = useRef<MediaStream | null>(null);
  const [camFacing, setCamFacing] = useState<"environment" | "user">("environment");
  const [camReady, setCamReady] = useState(false);
  const recStartRef = useRef<number>(0);
  const seenRef = useRef<Set<string>>(new Set());
  const [myId, setMyId] = useState("");
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const sinceRef = useRef<string>("");

  useEffect(() => {
    if (!cameraOpen) return;
    const v = videoRef.current; const st = camStreamRef.current;
    if (v && st) { v.srcObject = st; v.play().then(() => setCamReady(true)).catch(() => {}); }
  }, [cameraOpen]);
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
    const timer = setInterval(() => { loadMsgs(sinceRef.current || undefined).then((arr) => { if (arr.length) { sinceRef.current = arr[arr.length - 1].createdAt; let meIdNow = ""; try { meIdNow = JSON.parse(localStorage.getItem("communica_user") ?? "{}").id ?? ""; } catch {} const incoming = arr.filter((m) => m.senderId !== meIdNow); if (incoming.length) { playReceiveSound(); const first = incoming[0]; void notifyMessage(first.sender?.displayName ?? "Communica", first.text ?? `${first.type} message`); } } }).catch(() => {}); }, 3000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [chatId, loadChat, loadMsgs, myId]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault(); setError("");
    const value = text.trim(); if (value === "" || busy) return; setBusy(true);
    try {
      const data = await apiJson("/api/messages", { method: "POST", body: { chatId, text: value, type: "TEXT", replyToId: replyTo?.id ?? null } }) as { message: Msg };
      setMsgs((prev) => [...prev, data.message]); setText(""); setReplyTo(null); sinceRef.current = data.message.createdAt; playSendSound();
    } catch (err) { setError(err instanceof Error ? err.message : "send failed — message was not sent"); }
    setBusy(false);
  };
  const sendMedia = async (file: File, forcedType?: string, fileText?: string, durationSec?: number) => {
    setError("");
    const normMime = file.type.startsWith("audio/webm") ? "audio/webm" : file.type.startsWith("audio/mp4") ? "audio/mp4" : file.type.startsWith("audio/ogg") ? "audio/ogg" : file.type;
    const kindFromMime = normMime.startsWith("image/") ? "PHOTO" : normMime.startsWith("audio/") ? "VOICE" : normMime.startsWith("video/") ? "VIDEO" : "FILE";
    const type = forcedType ?? kindFromMime;
    try {
      const up = await uploadFile(file);
      const data = await apiJson("/api/messages", { method: "POST", body: { chatId, type: up.kind, mediaUrl: up.url, mediaMime: up.mime, text: fileText ?? null, durationSec: durationSec ?? null } }) as { message: Msg };
      setMsgs((prev) => [...prev, data.message]); sinceRef.current = data.message.createdAt; playSendSound();
    } catch (err) {
      // Own-system fallback for Vercel: /api/media writes to server-local
      // public/uploads, which does not persist on serverless hosts.
      // Small files (<5 MB) are stored as a data URL in our own DB
      // (Message.mediaUrl) — no external storage, no external API.
      if (file.size > 5 * 1024 * 1024) { setError(err instanceof Error ? err.message : "media send failed — file was not sent as a message"); return; }
      try {
        const dataUrl: string = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(new Error("could not read file")); r.readAsDataURL(file); });
        const data = await apiJson("/api/messages", { method: "POST", body: { chatId, type, mediaUrl: dataUrl, mediaMime: normMime, text: fileText ?? null, durationSec: durationSec ?? null } }) as { message: Msg };
        setMsgs((prev) => [...prev, data.message]); sinceRef.current = data.message.createdAt; playSendSound();
      } catch (err2) { setError(err2 instanceof Error ? err2.message : "media send failed — file was not sent as a message"); }
    }
  };
  const toggleRecord = async () => {
    if (recording) { try { recRef.current?.stop(); } catch {} setRecording(false); return; }
    try {
      if (!navigator.mediaDevices?.getUserMedia) { setError("Voice recording is not supported in this browser — try Chrome on Android or desktop Chrome."); return; }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg", ""];
      const mime = candidates.find((m) => m === "" || (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m))) ?? "";
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (ev) => { if (ev.data.size) chunksRef.current.push(ev.data); };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const base = rec.mimeType.startsWith("audio/webm") ? "audio/webm" : rec.mimeType.startsWith("audio/mp4") ? "audio/mp4" : rec.mimeType.startsWith("audio/ogg") ? "audio/ogg" : "audio/webm";
        const ext = base === "audio/mp4" ? "m4a" : base === "audio/ogg" ? "ogg" : "webm";
        const blob = new Blob(chunksRef.current, { type: base });
        const durSec = Math.max(0, Math.round((Date.now() - recStartRef.current) / 1000));
        // Never send an empty / too-short recording as a 0:00 bubble.
        if (blob.size < 2000 || durSec < 1) { setError("Voice was too short or empty — it was NOT sent. Speak for at least a second, then tap the mic again to stop and send."); return; }
        void sendMedia(new File([blob], `voice.${ext}`, { type: base }), "VOICE", undefined, durSec);
      };
      recRef.current = rec; recStartRef.current = Date.now(); rec.start(); setRecording(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      setError(/denied|permission/i.test(msg) ? "Microphone permission denied — allow the microphone and try again." : "Microphone could not be started — voice message was not recorded.");
    }
  };
  const openCamera = async (facing: "environment" | "user" = "environment") => {
    setCameraError(""); setCamReady(false); setCamFacing(facing);
    try {
      if (!navigator.mediaDevices?.getUserMedia) { document.getElementById("chat-camera")?.click(); return; }
      camStreamRef.current?.getTracks().forEach((t) => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } } });
      camStreamRef.current = stream; setCameraOpen(true);
      // Attach in the cameraOpen effect too (render race was the black-preview bug);
      // attach here as well in case the video element is already mounted.
      const v = videoRef.current; if (v) { v.srcObject = stream; v.play().then(() => setCamReady(true)).catch(() => {}); }
    } catch { document.getElementById("chat-camera")?.click(); }
  };
  const switchCamera = () => { void openCamera(camFacing === "environment" ? "user" : "environment"); };
  const capturePhoto = () => {
    const video = videoRef.current; if (!video) return;
    if (!video.videoWidth || !video.videoHeight) { setCameraError("Camera frame is not ready yet — wait a second for the preview to appear, then try again. A black photo will not be sent."); return; }
    const canvas = document.createElement("canvas"); canvas.width = video.videoWidth || 640; canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d"); if (!ctx) return; ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      camStreamRef.current?.getTracks().forEach((t) => t.stop()); camStreamRef.current = null; setCameraOpen(false);
      void sendMedia(new File([blob], "camera.jpg", { type: "image/jpeg" }), "PHOTO");
    }, "image/jpeg", 0.9);
  };
  const closeCamera = () => { camStreamRef.current?.getTracks().forEach((t) => t.stop()); camStreamRef.current = null; setCameraOpen(false); setCamReady(false); };
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
    try { await apiJson("/api/contacts", { method: "POST", body: { identifier: other.username } }); setContactMsg("Contact request sent — the other user must accept it before calls are allowed. Open Contacts from the Chats screen to see Pending / Accepted status."); }
    catch (err) { const msg = err instanceof Error ? err.message : ""; setContactMsg(/already exists/i.test(msg) ? "Already in contacts — open Contacts from the Chats screen to see Pending / Accepted status." : (msg || "could not add contact")); }
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
      <h1>{group ? <Link href={`/groups/${chatId}/info`} aria-label="View group profile">{name}</Link> : other ? <Link href={`/contacts/${other.username}`} aria-label="View contact profile">{name}</Link> : name}</h1>
      <div className="topbar-actions">
        {other ? <><Link className="icon-btn" href={`/call?to=${encodeURIComponent(other.displayName)}&callee=${other.username}&kind=audio&variant=outgoing`} aria-label="Audio call"><Phone size={22} /></Link><Link className="icon-btn" href={`/call?to=${encodeURIComponent(other.displayName)}&callee=${other.username}&kind=video&variant=outgoing`} aria-label="Video call"><Video size={22} /></Link></> : null}
        <div className="chat-menu-wrap"><button type="button" className="icon-btn" aria-label="More options" onClick={() => setMenuOpen(!menuOpen)}><MoreVertical size={22} /></button>{menuOpen ? <div className="chat-menu"><Link href="/new-group" onClick={() => setMenuOpen(false)}>New group</Link>{other ? <button type="button" onClick={() => { setMenuOpen(false); void addContact(); }}>Add to contacts</button> : null}<button type="button" onClick={() => { setMenuOpen(false); setShowMedia(false); setShowSearch(!showSearch); }}>Search in chat</button><button type="button" onClick={() => { setMenuOpen(false); setShowSearch(false); setShowMedia(!showMedia); }}>Media, links, and docs</button><Link href="/settings" onClick={() => setMenuOpen(false)}>Chat theme</Link>{other ? <Link href={`/contacts/${other.username}`} onClick={() => setMenuOpen(false)}>View contact</Link> : null}{group ? <Link href={`/groups/${chatId}/info`} onClick={() => setMenuOpen(false)}>Group info</Link> : null}<button type="button" onClick={() => { setMenuOpen(false); void favChat(); }}>Favourite</button><button type="button" onClick={() => { setMenuOpen(false); void archiveChat(true); }}>Archive</button>{other ? <button type="button" onClick={() => { setMenuOpen(false); void blockChat(); }}>Block</button> : null}</div> : null}</div>
      </div>
    </header>
    <div className="chat-view">{contactMsg ? <p className="chat-panel" role="status">{contactMsg}</p> : null}{showSearch ? <div className="chat-panel"><input value={chatSearch} onChange={(e) => setChatSearch(e.target.value)} placeholder="Search in this chat…" aria-label="Search in this chat" /><button type="button" className="btn btn-light" onClick={() => { setChatSearch(""); setShowSearch(false); }}>Close</button><span>Searches loaded messages only (last 50).</span>{chatSearch.trim() !== "" ? <span>{displayMsgs.length} match{displayMsgs.length === 1 ? "" : "es"} in loaded messages</span> : null}</div> : null}{showMedia ? <div className="chat-panel"><h3>Media</h3>{msgs.filter((m) => m.mediaUrl).length ? <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{msgs.filter((m) => m.mediaUrl).map((m) => (<span key={m.id}>{m.type === "PHOTO" && m.mediaUrl ? <img src={m.mediaUrl} alt="Shared photo" style={{ width: 96, height: 96, objectFit: "cover", borderRadius: 8 }} /> : m.type === "VIDEO" && m.mediaUrl ? <video src={m.mediaUrl} style={{ width: 120, borderRadius: 8 }} controls /> : m.type === "VOICE" && m.mediaUrl ? <VoicePlayer src={m.mediaUrl} fallbackSec={m.durationSec} /> : null}</span>))}</div> : <p>No media shared yet.</p>}<h3>Links</h3>{(() => { const links: string[] = []; msgs.forEach((m) => { const found = (m.text ?? "").match(/https?:\/\/[^\s]+/g); if (found) links.push(...found); }); return links.length ? <ul>{links.map((u, i) => (<li key={i}><a href={u} target="_blank" rel="noreferrer">{u}</a></li>))}</ul> : <p>No links shared yet.</p>; })()}<h3>Docs</h3>{msgs.filter((m) => m.type === "FILE" && m.mediaUrl).length ? <ul>{msgs.filter((m) => m.type === "FILE" && m.mediaUrl).map((m) => (<li key={m.id}><a href={m.mediaUrl!} target="_blank" rel="noreferrer">{m.text ?? "File"}</a></li>))}</ul> : <p>No documents shared yet.</p>}<button type="button" className="btn btn-light" onClick={() => setShowMedia(false)}>Close</button></div> : null}<div className="chat-bg">
      {!msgs.length && !error ? <p className="empty">No messages yet — send the first message below.</p> : null}{msgsWithDate.map(({ m, showDate }) => {
        const mine = m.senderId === myId;
        const senderName = m.sender?.displayName ?? (mine ? "You" : "");
        return <div key={m.id} style={{ display: "contents" }}>{showDate ? <div className="date-pill"><span>{new Date(m.createdAt).toLocaleDateString([], { year: "numeric", month: "long", day: "numeric" })}</span></div> : null}<div className={mine ? "bubble bubble-me" : "bubble bubble-other"} onClick={() => setSelectedId(selectedId === m.id ? null : m.id)}>
          {group && !mine ? <span className="bubble-sender">{senderName}</span> : null}
          {m.deletedForAll ? <span><em>This message was deleted</em></span> : <>
            {m.replyToId ? <span style={{ fontSize: 13, opacity: 0.8 }}>Replying to a message</span> : null}
            {m.type === "PHOTO" && m.mediaUrl ? <><img src={m.mediaUrl} alt="Shared photo" style={{ maxWidth: "100%", borderRadius: 8 }} /><br /></> : null}
            {m.type === "VOICE" && m.mediaUrl ? <><VoicePlayer src={m.mediaUrl} fallbackSec={m.durationSec} /><br /></> : null}
            {m.type === "VIDEO" && m.mediaUrl ? <><video controls src={m.mediaUrl} style={{ maxWidth: "100%" }} /><br /></> : null}
            {m.type === "FILE" ? <span><FileIcon size={16} /> {m.text ?? "File"}{m.mediaUrl ? <> — <a href={m.mediaUrl} target="_blank" rel="noreferrer">Download</a></> : null}</span> : <span>{m.text}</span>}
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
    </div>
    {emojiOpen ? <div className="emoji-picker">{["😊", "❤️", "👍", "😂", "🙏", "🎉", "😢", "🔥", "👋", "✅", "🌸", "🙌"].map((e) => (<button key={e} type="button" aria-label="Insert emoji" onClick={() => { setText(text + e); setEmojiOpen(false); }}>{e}</button>))}</div> : null}
    {recording ? <p className="chat-panel" role="status">Recording voice… tap the mic again to stop and send.</p> : null}
    {cameraOpen ? <div style={{ position: "fixed", inset: 0, zIndex: 90, background: "#000", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 12, color: "#fff" }}><span>{camReady ? "Camera ready" : "Starting camera…"}</span><button type="button" className="btn btn-light" onClick={closeCamera}>✕ Close</button></div>
      <video ref={videoRef} autoPlay playsInline muted onPlaying={() => setCamReady(true)} style={{ flex: 1, width: "100%", height: "100%", objectFit: "cover", background: "#000" }} />
      {!camReady ? <p style={{ color: "#fff", textAlign: "center", padding: 12 }}>If the preview stays black, check camera permission for this site, then try Switch camera.</p> : null}
      {cameraError ? <p role="alert" style={{ color: "#fff", padding: "0 16px" }}>{cameraError}</p> : null}
      <p style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", padding: 16 }}><button type="button" className="btn btn-green" onClick={capturePhoto}>Take photo &amp; send</button><button type="button" className="btn btn-light" onClick={switchCamera}>Switch camera</button><button type="button" className="btn btn-light" onClick={closeCamera}>Cancel</button></p>
    </div> : null}
    <input id="chat-file" type="file" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) void sendMedia(f, "FILE", f.name); e.target.value = ""; }} />
    <form className="composer" onSubmit={send}>
      <label style={{ display: "none" }} htmlFor="chat-photo">Attach photo</label>
      <input id="chat-photo" type="file" accept="image/jpeg,image/png,image/webp,image/gif" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) void sendMedia(f); e.target.value = ""; }} />
      <input id="chat-camera" type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) void sendMedia(f); e.target.value = ""; }} />
      <button type="button" className="icon-btn" aria-label="Emoji" onClick={() => setEmojiOpen(!emojiOpen)}><Smile size={22} /></button>
      <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Message…" aria-label="Message" />
      <button type="button" className="icon-btn" aria-label="Send photo" onClick={() => document.getElementById("chat-photo")?.click()}><ImageIcon size={22} /></button>
      <button type="button" className="icon-btn" aria-label="Take photo with camera" onClick={() => void openCamera()}><Camera size={22} /></button><button type="button" className="icon-btn" aria-label="Send file" onClick={() => document.getElementById("chat-file")?.click()}><FileIcon size={22} /></button>
      {text.trim() === "" ? <button type="button" className={recording ? "icon-btn icon-btn-recording" : "icon-btn"} aria-label={recording ? "Stop voice recording" : "Record voice message"} onClick={() => void toggleRecord()}><Mic size={22} /></button> : <button type="submit" className="icon-btn icon-btn-send" aria-label="Send" disabled={busy}><Send size={22} /></button>}
    </form></div>
  </div>;
}
