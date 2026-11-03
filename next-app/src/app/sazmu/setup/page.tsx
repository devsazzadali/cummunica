"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Bot } from "lucide-react";
import { AppShell } from "@/components/ui";
import { GIRLFRIEND_PRESETS, BOYFRIEND_DEFAULT } from "@/lib/demo-data";
export default function SazmuSetupPage(){
 const [role,setRole]=useState<"Boyfriend"|"Girlfriend">("Boyfriend");
 const [name,setName]=useState(BOYFRIEND_DEFAULT); const [custom,setCustom]=useState(""); const [pet,setPet]=useState(""); const [tone,setTone]=useState("Emotional and romantic"); const [lang,setLang]=useState("Banglish"); const [saved,setSaved]=useState(false); const [savedReal,setSavedReal]=useState(false); const [error,setError]=useState("");
 const save=async()=>{ setError("");
  let token:string|null=null; try{ token=localStorage.getItem("communica_token"); }catch{}
  if(!token){ setError("Login required — setup was not saved."); return; }
  try{
   const language=lang.startsWith("Bengali")?"Bengali":lang;
   const res=await fetch("/api/sazmu",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({action:"setup",role,callName:custom||name,petName:pet||null,tone,language})});
   const data=await res.json(); if(!res.ok) throw new Error(data.message ?? "setup failed");
   setSavedReal(true); setSaved(true);
  }catch(err){ setError(err instanceof Error?err.message:"setup failed"); }
 };
 const presets=role==="Boyfriend"?[BOYFRIEND_DEFAULT]:GIRLFRIEND_PRESETS;
 return <AppShell requireLogin active="" hideHeader><header className="topbar"><Link className="icon-btn" href="/sazmu" aria-label="Back"><ArrowLeft size={22}/></Link><h1>SAZMU AI Setup</h1></header>
 <div className="wrap"><p><Bot size={22}/> SAZMU AI is always labelled AI — never a real human.</p>
  <p>Role</p><div className="chip-row">{(["Boyfriend","Girlfriend"] as const).map(r=>(<button key={r} type="button" className={role===r?"chip chip-on":"chip"} onClick={()=>{setRole(r);setName(r==="Boyfriend"?BOYFRIEND_DEFAULT:"");}}>{r}</button>))}</div>
  <p>Call name — tap a preset, or type a custom name below</p><div className="chip-row">{presets.map(p=>(<button key={p} type="button" className={name===p?"chip chip-on":"chip"} onClick={()=>setName(p)}>{p}</button>))}</div>
  <label htmlFor="custom-name">Custom name</label><input id="custom-name" value={custom} onChange={e=>setCustom(e.target.value)} placeholder="Type a custom call name"/>
  <label htmlFor="pet-name">Pet name (what the companion calls you)</label><input id="pet-name" value={pet} onChange={e=>setPet(e.target.value)} placeholder="e.g. baby / sweetheart"/>
  <p>Tone</p><div className="chip-row">{["Emotional and romantic","Friendly","Playful / teasing","Calm and comforting"].map(t=>(<button key={t} type="button" className={tone===t?"chip chip-on":"chip"} onClick={()=>setTone(t)}>{t}</button>))}</div>
  <p>Language</p><div className="chip-row">{["Bengali (বাংলা)","Banglish","English"].map(l=>(<button key={l} type="button" className={lang===l?"chip chip-on":"chip"} onClick={()=>setLang(l)}>{l}</button>))}</div>
  <p style={{marginTop:16}}><button type="button" className="btn btn-green btn-full" onClick={save}>Save &amp; open SAZMU AI chat</button></p>
  {error?<><p role="alert">Setup failed: {error} — nothing was saved.</p><p>Live setup did not succeed. Log in and try again — nothing was saved.</p></>:null}
  {saved&&savedReal?<><p>Setup saved to the server. Selected: {role}, call name {custom||name||"(none)"}, tone {tone}, language {lang}.</p><p>Replies are template-only until an LLM provider/key is provided — no generative reply is faked.</p><Link className="btn btn-light btn-full" href="/sazmu">Open SAZMU AI chat</Link></>:null}
 </div></AppShell>;
}
