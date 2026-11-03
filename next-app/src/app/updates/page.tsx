"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, CircleDot } from "lucide-react";
import { AppShell, Avatar } from "@/components/ui";
import { apiJson, type StatusItem } from "@/lib/api-client";
export default function UpdatesPage(){
 const [items,setItems]=useState<StatusItem[]|null>(null); const [error,setError]=useState("");
 useEffect(()=>{ (async()=>{ try{ const d=await apiJson("/api/status") as {statuses:StatusItem[]}; setItems(d.statuses); }catch(err){ setError(err instanceof Error?err.message:"failed to load updates"); } })(); },[]);
 return <AppShell active="Updates"><header className="topbar"><h1>Updates</h1></header>
 <div className="wrap"><h2>My Status</h2><Link className="btn btn-green" href="/my-status"><Plus size={22}/> Add / view My Status</Link><h2>Recent updates (24 hours, real)</h2></div>
 {error?<div className="wrap"><p role="alert">{error}</p><p><Link className="btn btn-green" href="/login">Login</Link></p></div>:items===null?<p className="empty">Loading…</p>:!items.length?<p className="empty">No visible statuses. Statuses expire after 24 hours and are only shown to accepted contacts.</p>:
 <div className="chat-list">{items.map(s=>(
  <Link key={s.id} className="status-card" href={`/updates/${s.id}`}><Avatar name={s.user?.displayName??"Status"}/><span className="chat-row-main"><strong>{s.user?.displayName??""}</strong><span className="chat-preview">{s.text??"Photo status"}</span><span className="chat-time">{new Date(s.createdAt).toLocaleString()}</span></span><CircleDot size={22}/></Link>))}</div>}
 </AppShell>;
}
