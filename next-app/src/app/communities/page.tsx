"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell, Avatar } from "@/components/ui";
import { apiJson, chatTitle, type ChatItem } from "@/lib/api-client";
export default function CommunitiesPage(){
 const [groups,setGroups]=useState<ChatItem[]|null>(null); const [error,setError]=useState("");
 useEffect(()=>{ (async()=>{ try{ const d=await apiJson("/api/chats?filter=groups") as {chats:ChatItem[]}; setGroups(d.chats); }catch(err){ setError(err instanceof Error?err.message:"failed to load communities"); } })(); },[]);
 return <AppShell requireLogin active="Communities"><header className="topbar"><h1>Communities</h1></header>
 <div className="wrap"><p>Communities here are real groups (there is no separate Community model and no invented moderation system — see the plan). Your groups are listed below; create a new one to start a community.</p><p><Link className="btn btn-green" href="/new-group">Create a community group</Link></p></div>
 {error?<div className="wrap"><p role="alert">{error}</p><p><Link className="btn btn-green" href="/login">Login</Link></p></div>:groups===null?<p className="empty">Loading…</p>:!groups.length?<p className="empty">You are in no groups yet.</p>:
 <div className="chat-list">{groups.map(c=>(<div key={c.chat.id} className="chat-row"><Avatar name={chatTitle(c)} group/><span className="chat-row-main"><strong>{chatTitle(c)}</strong><span className="chat-preview">{c.members.length} members</span></span><Link className="btn btn-light" href={`/groups/${c.chat.id}`}>Open group</Link></div>))}</div>}
 <div className="wrap"><p>Community moderation tools (who can post, admin controls beyond group admin) are pending — not faked here.</p></div></AppShell>;
}
