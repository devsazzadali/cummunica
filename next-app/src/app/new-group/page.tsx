"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/ui";
import { apiJson } from "@/lib/api-client";
type U={username:string;displayName:string;communicaId:string};
export default function NewGroupPage(){
 const router=useRouter();
 const [name,setName]=useState(""); const [members,setMembers]=useState<U[]>([]); const [q,setQ]=useState(""); const [results,setResults]=useState<U[]|null>(null); const [error,setError]=useState("");
 useEffect(()=>{
  const query=q.trim(); if(!query){ setResults(null); return; }
  let cancelled=false; const t=setTimeout(async()=>{ try{ const d=await apiJson(`/api/users/search?q=${encodeURIComponent(query)}`) as {results:U[]}; if(!cancelled) setResults(d.results); }catch{ if(!cancelled) setResults([]); } },300);
  return ()=>{ cancelled=true; clearTimeout(t); };
 },[q]);
 const create=async()=>{ setError(""); try{ const d=await apiJson("/api/chats",{method:"POST",body:{type:"GROUP",title:name,memberIdentifiers:members.map(m=>m.username)}}) as {chat:{id:string}}; router.push(`/groups/${d.chat.id}`); }catch(err){ setError(err instanceof Error?err.message:"could not create group"); } };
 return <AppShell requireLogin active="Chats" hideHeader><header className="topbar"><Link className="icon-btn" href="/chats" aria-label="Back"><ArrowLeft size={22}/></Link><h1>New Group</h1></header>
 <div className="wrap"><label htmlFor="group-name">Group name</label><input id="group-name" value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Family Group"/>
  <label htmlFor="member-search">Add members by @username or 8-digit ID</label><input id="member-search" value={q} onChange={e=>setQ(e.target.value)} placeholder="@username or 8-digit ID"/>
  {results!==null?<div className="chat-list">{results.map(u=>(<div key={u.username} className="chat-row"><span className="chat-row-main"><strong>{u.displayName}</strong><span className="chat-preview">@{u.username}</span></span><button type="button" className="btn btn-light" onClick={()=>{ if(!members.some(m=>m.username===u.username)) setMembers([...members,u]); }}>Add</button></div>))}{!results.length?<p className="empty">No match.</p>:null}</div>:null}
  <p>Selected ({members.length}): {members.map(m=>m.displayName).join(", ")||"none"}</p>
  <p><button type="button" className="btn btn-green btn-full" onClick={()=>void create()}>Create group</button></p>
  {error?<p role="alert">{error}</p>:null}</div></AppShell>;
}
