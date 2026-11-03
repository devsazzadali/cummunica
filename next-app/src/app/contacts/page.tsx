"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell, Avatar } from "@/components/ui";
import { apiJson } from "@/lib/api-client";
type C = { username: string; displayName: string; communicaId: string; accepted: boolean; isBlocked: boolean };
export default function ContactsPage() {
  const [list, setList] = useState<C[] | null>(null);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const load = async () => {
    try { const d = await apiJson("/api/contacts") as { contacts: C[] }; setList(d.contacts); }
    catch (err) { setError(err instanceof Error ? err.message : "could not load contacts"); }
  };
  useEffect(() => { void load(); }, []);
  const accept = async (u: C) => {
    setError(""); setInfo("");
    try {
      await apiJson("/api/contacts", { method: "POST", body: { identifier: u.username } }).catch(() => {});
      await apiJson("/api/contacts", { method: "PATCH", body: { identifier: u.username, accepted: true } });
      setInfo(`${u.displayName} accepted — they can now call you, and you can call them once they have accepted you in return.`);
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : "could not accept contact"); }
  };
  return <AppShell requireLogin active="Chats"><header className="topbar"><h1>Contacts</h1></header>
    <div className="wrap">
      <p>Calls only go to accepted contacts. Messaging alone does not accept someone — the other person must tap Accept here (or on your profile) before a call can connect.</p>
      {info ? <p role="status">{info}</p> : null}{error ? <p role="alert">{error}</p> : null}
      {list === null ? <p className="empty">Loading contacts…</p> : !list.length ? <p className="empty">No contacts yet. Search for someone in New Chat and tap Add to contacts.</p> : list.map((c) => (
        <div key={c.username} className="chat-row-wrap"><div className="chat-row" style={{ cursor: "default" }}>
          <Avatar name={c.displayName} />
          <span className="chat-row-main"><span className="chat-row-top"><strong>{c.displayName}</strong><span>{c.accepted ? "Accepted" : "Pending"}</span></span>
          <span className="chat-row-bottom"><span>@{c.username} • ID {c.communicaId}</span>
          {!c.accepted ? <button type="button" className="btn btn-green" style={{ minHeight: 44, padding: "10px 14px" }} onClick={() => void accept(c)}>Accept</button> : null}
          <Link className="btn btn-light" style={{ minHeight: 44, padding: "10px 14px" }} href={`/contacts/${c.username}`}>View profile</Link></span></span>
        </div></div>
      ))}
      <p><Link className="btn btn-light btn-full" href="/new-chat">Find someone new</Link></p>
    </div></AppShell>;
}
