"use client";
import { useState } from "react";
import Link from "next/link";
import { Plus, Search, Hash } from "lucide-react";
import { AppShell, SearchBar, TwoPane } from "@/components/ui";
import { RealChatList } from "@/components/real-chat";
type F="all"|"unread"|"favorites"|"groups";
export default function ChatsPage(){
 const [filter,setFilter]=useState<F>("all");
 const list=<div><header className="topbar"><h1>Communica</h1><Link className="icon-btn" href="/new-chat" aria-label="New chat"><Plus size={22}/></Link></header>
  <SearchBar placeholder="Search chats…" href="/new-chat"/>
  <div className="filter-tabs" role="tablist">
   {(["all","unread","favorites","groups"] as F[]).map(f=>(<button key={f} className={filter===f?"on":""} onClick={()=>setFilter(f)}>{f==="all"?"All":f==="unread"?"Unread":f==="favorites"?"Favorites":"Groups"}</button>))}
   <Link href="/archived">Archived</Link><Link href="/favorites">Favorites</Link>
  </div>
  <RealChatList filter={filter}/>
  <div className="wrap"><Link className="btn btn-green btn-full" href="/new-group"><Plus size={22}/> New Group</Link><p style={{display:"flex",gap:8,flexWrap:"wrap"}}><Link className="btn btn-light" href="/new-chat"><Search size={22}/> New Chat / Search people</Link><Link className="btn btn-light" href="/keypad"><Hash size={22}/> Keypad</Link></p></div></div>;
 const detail=<div className="pane-placeholder"><h2>Communica</h2><p>Select a chat on the left to open it here (desktop two-pane view).</p><p>On mobile, chats open as a single full screen.</p></div>;
 return <AppShell active="Chats"><TwoPane list={list} detail={detail}/></AppShell>;
}
