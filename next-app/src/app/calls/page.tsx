"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Phone, Video, Hash, PhoneIncoming, PhoneOutgoing, PhoneMissed } from "lucide-react";
import { AppShell, Avatar } from "@/components/ui";
import { apiJson } from "@/lib/api-client";
type CallRow={id:string;type:string;status:string;startedAt:string;durationSec:number|null;caller:{username:string;displayName:string;communicaId:string};callee:{username:string;displayName:string;communicaId:string}};
export default function CallsPage(){
 const [calls,setCalls]=useState<CallRow[]|null>(null); const [error,setError]=useState(""); const [me,setMe]=useState("");
 useEffect(()=>{ try{ setMe(JSON.parse(localStorage.getItem("communica_user")??"{}").username??""); }catch{} (async()=>{ try{ const d=await apiJson("/api/calls") as {calls:CallRow[]}; setCalls(d.calls); }catch(err){ setError(err instanceof Error?err.message:"failed to load calls"); } })(); },[]);
 return <AppShell requireLogin active="Calls"><header className="topbar"><h1>Calls</h1><div className="topbar-actions"><Link className="icon-btn" href="/keypad" aria-label="Keypad"><Hash size={22}/></Link></div></header>
 <div className="wrap"><p><Link className="btn btn-light" href="/call?kind=audio&variant=incoming">Listen for a real incoming audio call</Link> <Link className="btn btn-light" href="/call?kind=video&variant=incoming">Listen for a real incoming video call</Link></p>
  <p>Only real CallLog rows are listed below. Anyone can call anyone directly with a Communica ID or username — no contact acceptance is needed. A blocked user cannot call you, and the call screen says so plainly instead of simulating a call.</p></div>
 <h2 style={{padding:"0 16px"}}>Recent Calls</h2>
 {error?<div className="wrap"><p role="alert">{error}</p><p><Link className="btn btn-green" href="/login">Login</Link></p></div>:calls===null?<p className="empty">Loading calls…</p>:!calls.length?<p className="empty">No calls yet.</p>:
 <div className="chat-list">{calls.map(c=>{ const other=c.caller.username===me?c.callee:c.caller; const Icon=c.status==="MISSED"?PhoneMissed:c.caller.username===me?PhoneOutgoing:PhoneIncoming; return (
  <Link key={c.id} className="chat-row" href={`/call?to=${encodeURIComponent(other.displayName)}&callee=${other.username}&kind=${c.type==="VIDEO"?"video":"audio"}&variant=outgoing`}><Avatar name={other.displayName}/><span className="chat-row-main"><strong>{other.displayName}</strong><span className="chat-preview"><Icon size={14}/> {c.status}{c.durationSec?` · ${c.durationSec}s`:""} · {c.type} (in-app only)</span></span>{c.type==="VIDEO"?<Video size={22}/>:<Phone size={22}/>}</Link>);})}</div>}
 </AppShell>;
}
