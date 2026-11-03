"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Settings, ArrowLeft } from "lucide-react";
import { AppShell, Avatar } from "@/components/ui";
import { Composer } from "@/components/interactive";
import { apiJson } from "@/lib/api-client";
export default function SazmuPage(){
 const [ready,setReady]=useState<"loading"|"ready"|"setup"|"login">("loading"); const [name,setName]=useState("SAZMU AI");
 useEffect(()=>{ (async()=>{ try{ const d=await apiJson("/api/sazmu") as {setting:{callName:string}}; setName(d.setting.callName); setReady("ready"); }catch(err){ const m=err instanceof Error?err.message:""; setReady(m.includes("not set up")||m.includes("companion not set up")?"setup":"login"); } })(); },[]);
 return <AppShell active="Chats"><header className="topbar"><Link className="icon-btn" href="/chats" aria-label="Back"><ArrowLeft size={22}/></Link><Avatar name="SAZMU AI" ai/><h1>SAZMU AI · AI — not a human</h1><div className="topbar-actions"><Link className="icon-btn" href="/sazmu/setup" aria-label="SAZMU AI setup"><Settings size={22}/></Link></div></header>
 {ready==="loading"?<p className="empty">Loading SAZMU AI…</p>:ready==="login"?<div className="wrap"><p>Login to chat with SAZMU AI. No message is sent without login.</p><p><Link className="btn btn-green" href="/login">Login</Link></p></div>:ready==="setup"?<div className="wrap"><p>Set up SAZMU AI first (role + call name).</p><p><Link className="btn btn-green" href="/sazmu/setup">Open SAZMU AI setup</Link></p></div>:
 <><Composer initial={[]} ai apiMode="sazmu"/><div className="wrap"><p className="ai-label">Template replies only until an LLM provider/key is provided by the user — no generative reply is faked. Your setup and stated memories are stored for your account only (see /api/sazmu). Companion call name: {name}.</p></div></>}
 </AppShell>;
}
