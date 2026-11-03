"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Bot } from "lucide-react";
import { Avatar as Av, AppShell } from "@/components/ui";
import { apiJson, getToken } from "@/lib/api-client";
type LiveUser={username:string;displayName:string;communicaId:string;avatarUrl:string|null;bio:string|null};
export default function NewChatPage(){
 const router=useRouter();
 const [q,setQ]=useState(""); const [live,setLive]=useState<LiveUser[]|null>(null); const [liveError,setLiveError]=useState(""); const [error,setError]=useState(""); const [notice,setNotice]=useState(""); const [loggedIn,setLoggedIn]=useState(false);
 useEffect(()=>{ setLoggedIn(!!getToken()); },[]);
 useEffect(()=>{
  const query=q.trim(); setLiveError("");
  if(!loggedIn || !query){ setLive(null); return; }
  let cancelled=false;
  const t=setTimeout(async()=>{
   try{ const data=await apiJson(`/api/users/search?q=${encodeURIComponent(query)}`) as {results:LiveUser[]}; if(!cancelled) setLive(data.results); }
   catch(err){ if(!cancelled){ setLiveError(err instanceof Error?err.message:"search failed"); setLive(null); } }
  },300);
  return ()=>{ cancelled=true; clearTimeout(t); };
 },[q,loggedIn]);
 const query=q.trim(); const isId=/^\d+$/.test(query);
 const startChat=async(u:LiveUser)=>{ setError(""); setNotice(""); try{ const d=await apiJson("/api/chats",{method:"POST",body:{type:"DIRECT",otherIdentifier:u.username}}) as {chat:{id:string;type:string}}; router.push(d.chat.type==="GROUP"?`/groups/${d.chat.id}`:`/chats/${d.chat.id}`); }catch(err){ setError(err instanceof Error?err.message:"could not start chat"); } };
 const addContact=async(u:LiveUser)=>{ setError(""); setNotice(""); try{ await apiJson("/api/contacts",{method:"POST",body:{identifier:u.username}}); setNotice("Contact request sent — the other user must accept it before calls are allowed."); }catch(err){ setError(err instanceof Error?err.message:"could not add contact"); } };
 return <AppShell active="Chats"><main><header className="topbar"><Link className="icon-btn" href="/chats" aria-label="Back"><ArrowLeft size={22}/></Link><h1>New Chat / Search</h1></header>
 <div className="wrap"><p>Find people by <strong>exact 8-digit Communica ID</strong> (partial ID search is NOT supported) OR by @username (exact or prefix).</p>
  <label htmlFor="people-search">Type 8-digit ID or @username…</label><input id="people-search" value={q} onChange={e=>setQ(e.target.value)} placeholder="Type 8-digit ID or @username…"/>
  {isId&&query.length!==8?<p>Communica IDs are exactly 8 digits.</p>:null}
  {!loggedIn?<p>Live search needs login. <Link href="/login">Login</Link> — no demo people are shown, so nothing here can be mistaken for a real account.</p>:null}
  {liveError?<p role="alert">Live search failed: {liveError}</p>:null}
  {error?<p role="alert">{error}</p>:null}
  {notice?<p role="status">{notice}</p>:null}
  {live!==null?<><h2>Results</h2><div className="chat-list">{live.map(u=>(
    <div key={u.username} className="chat-row"><Av name={u.displayName}/><span className="chat-row-main"><strong>{u.displayName}</strong><span className="chat-preview">@{u.username} • ID {u.communicaId}{u.bio?` • ${u.bio}`:""}</span></span><span style={{display:"flex",gap:6}}><button type="button" className="btn btn-green" onClick={()=>void startChat(u)}>Message</button><button type="button" className="btn btn-light" onClick={()=>void addContact(u)}>Add contact</button></span></div>))}
  </div>{!live.length?<p className="empty">No exact match. Try an exact 8-digit ID or a @username prefix.</p>:null}</>:null}
  <p><Link className="btn btn-light btn-full" href="/sazmu/setup"><Bot size={22}/> Open SAZMU AI (labelled AI) setup</Link></p></div></main></AppShell>;
}
