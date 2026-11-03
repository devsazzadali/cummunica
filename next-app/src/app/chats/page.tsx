"use client";
import { useState } from "react";
import Link from "next/link";
import { Plus, Search, Hash } from "lucide-react";
import { AppShell, TwoPane } from "@/components/ui";
import { RealChatList } from "@/components/real-chat";
type F="all"|"unread"|"favorites"|"groups";
export default function ChatsPage(){
 const [filter,setFilter]=useState<F>("all");
 const [q,setQ]=useState("");
 // Home = communication history only. No brand header on mobile (AppShell header
 // is hidden on mobile via hideHeader), no New Group / New Chat / Keypad buttons
 // in the middle of the list — WhatsApp keeps those on the New Chat screen and
 // behind the bottom-right FABs, not on top of the chat history.
 const list=<div>
  <div className="search-bar chat-search-bar"><Search size={22}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search chats…" aria-label="Search chats" type="search"/></div>
  <div className="filter-tabs" role="tablist">
   {(["all","unread","favorites","groups"] as F[]).map(f=>(<button key={f} className={filter===f?"on":""} onClick={()=>setFilter(f)}>{f==="all"?"All":f==="unread"?"Unread":f==="favorites"?"Favorites":"Groups"}</button>))}
   <Link href="/archived">Archived</Link>
   <Link href="/contacts">Contacts</Link>
  </div>
  <RealChatList filter={filter} q={q}/>
  <div className="fab-stack"><Link href="/keypad" className="fab fab-secondary" aria-label="Keypad"><Hash size={24}/></Link><Link href="/new-chat" className="fab" aria-label="New chat"><Plus size={24}/></Link></div></div>;
 const detail=<div className="pane-placeholder"><h2>Select a chat</h2><p>Select a chat on the left to open it here (desktop two-pane view).</p><p>On mobile, chats open as a single full screen.</p></div>;
 return <AppShell requireLogin active="Chats" hideHeader><TwoPane list={list} detail={detail}/></AppShell>;
}
