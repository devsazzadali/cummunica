"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Image as ImageIcon, Eye } from "lucide-react";
import { apiJson, uploadFile, type StatusItem } from "@/lib/api-client";
export default function MyStatusPage(){
 const [text,setText]=useState(""); const [mine,setMine]=useState<StatusItem[]|null>(null); const [error,setError]=useState(""); const [info,setInfo]=useState("");
 const load=async()=>{ try{ const d=await apiJson("/api/status?mine=1") as {statuses:StatusItem[]}; setMine(d.statuses); }catch(err){ setError(err instanceof Error?err.message:"failed to load your statuses"); } };
 useEffect(()=>{ void load(); },[]);
 const post=async(mediaUrl?:string,mediaMime?:string)=>{ setError(""); setInfo(""); try{ await apiJson("/api/status",{method:"POST",body:{text,mediaUrl,mediaMime}}); setInfo("Status posted — visible to accepted contacts for 24 hours."); setText(""); await load(); }catch(err){ setError(err instanceof Error?err.message:"status was not posted"); } };
 const postPhoto=async(f:File)=>{ setError(""); try{ const up=await uploadFile(f); await post(up.url,up.mime); }catch(err){ setError(err instanceof Error?err.message:"photo status was not posted"); } };
 return <main><header className="topbar"><Link className="icon-btn" href="/updates" aria-label="Back"><ArrowLeft size={22}/></Link><h1>My Status</h1></header>
 <div className="wrap"><p>Your status is visible to accepted contacts for 24 hours, then it expires.</p>
  <label htmlFor="my-status-text">Status text</label><input id="my-status-text" value={text} onChange={e=>setText(e.target.value)} placeholder="Share an update…"/>
  <p><button type="button" className="btn btn-green btn-full" onClick={()=>void post()}>Post status</button></p>
  <p><label className="btn btn-light btn-full" style={{cursor:"pointer"}}><ImageIcon size={22}/> Post photo status<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" style={{display:"none"}} onChange={e=>{ const f=e.target.files?.[0]; if(f) void postPhoto(f); e.target.value=""; }}/></label></p>
  {info?<p>{info}</p>:null}{error?<p role="alert">{error}</p>:null}
  <h2><Eye size={22}/> Who viewed your statuses</h2>
  {mine===null?<p className="empty">Loading…</p>:!mine.length?<p className="empty">No live statuses.</p>:mine.map(s=>(<div key={s.id} className="chat-list"><div className="chat-row"><span className="chat-row-main"><strong>{s.text??"Photo status"}</strong><span className="chat-preview">Viewed by: {s.viewers?.length?s.viewers.map(v=>v.displayName).join(", "):"no one yet"} · expires {new Date(s.expiresAt).toLocaleString()}</span></span><button type="button" className="btn btn-light" onClick={async()=>{ try{ await apiJson(`/api/status?id=${s.id}`,{method:"DELETE"}); await load(); }catch(err){ setError(err instanceof Error?err.message:"delete failed"); } }}>Delete</button></div></div>))}
  <p><Link className="btn btn-light btn-full" href="/updates">Back to Updates</Link></p></div></main>;
}
