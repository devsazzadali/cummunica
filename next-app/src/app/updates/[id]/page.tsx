"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, MessageCircle, ArrowLeft } from "lucide-react";
import { AppShell, Avatar } from "@/components/ui";
import { apiJson, type StatusItem } from "@/lib/api-client";
export default function StatusViewerPage({params}:{params:{id:string}}){
 const router=useRouter();
 const [list,setList]=useState<StatusItem[]>([]); const [error,setError]=useState(""); const [msg,setMsg]=useState("");
 useEffect(()=>{ (async()=>{ try{ const d=await apiJson("/api/status") as {statuses:StatusItem[]}; setList(d.statuses);
   try{ await apiJson("/api/status",{method:"POST",body:{action:"view",statusId:params.id}}); }catch{}
 }catch(err){ setError(err instanceof Error?err.message:"failed to load status"); } })(); },[params.id]);
 const idx=Math.max(0,list.findIndex(s=>s.id===params.id)); const s=list[idx]; const prev=list[(idx-1+list.length)%list.length]; const next=list[(idx+1)%list.length];
 const reply=async()=>{ if(!s?.user) return; try{ const d=await apiJson("/api/chats",{method:"POST",body:{type:"DIRECT",otherIdentifier:s.user.username}}) as {chat:{id:string}}; router.push(`/chats/${d.chat.id}`); }catch(err){ setMsg(err instanceof Error?err.message:"could not open chat"); } };
 return <AppShell active="Updates"><header className="topbar"><Link className="icon-btn" href="/updates" aria-label="Back"><ArrowLeft size={22}/></Link><h1>Status viewer</h1></header>
 {s?<div className="wrap" style={{textAlign:"center"}}><Avatar name={s.user?.displayName??"Status"} size={80}/><h2>{s.user?.displayName??""}</h2><p>{new Date(s.createdAt).toLocaleString()} • expires {new Date(s.expiresAt).toLocaleString()}</p>
  {s.mediaUrl?<img src={s.mediaUrl} alt="Status photo" style={{maxWidth:"100%",borderRadius:12}}/>:null}
  <p style={{fontSize:20}}>{s.text??""}</p>
  <p style={{display:"flex",gap:8,justifyContent:"center",flexWrap:"wrap"}}>{prev?<Link className="btn btn-light" href={`/updates/${prev.id}`}><ChevronLeft size={22}/> Previous</Link>:null}{next?<Link className="btn btn-light" href={`/updates/${next.id}`}>Next <ChevronRight size={22}/></Link>:null}</p>
  <p><button type="button" className="btn btn-light btn-full" onClick={()=>void reply()}><MessageCircle size={22}/> Reply to status</button></p>{msg?<p role="alert">{msg}</p>:null}</div>:
 <div className="wrap">{error?<><p role="alert">{error}</p>{error==="unauthenticated"?<p><Link className="btn btn-green btn-full" href="/login">Login</Link></p>:null}</>:<p className="empty">Loading status… (viewing is recorded only for a visible, unexpired status)</p>}</div>}</AppShell>;
}
