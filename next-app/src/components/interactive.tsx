"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Send, Delete, Phone, Video, MessageCircle } from "lucide-react";
import { Ticks, Avatar } from "@/components/ui";
import { apiJson, getToken, type ChatItem } from "@/lib/api-client";
import type { DemoMsg } from "@/lib/demo-data";
// F6: the dead fake-call component (simulated timer) and the
// unused demo button / demo form-note components were deleted
// from this file — no page imported them, and the real /call
// page uses CallScreen (WebRTC).
// F16: the SAZMU composer no longer has Attach/Photo/Voice
// buttons. They previously only popped a stale demo note on a
// live page; SAZMU attachments/voice are not wired for real, so
// the buttons are removed rather than left as fake affordances.
// Text sending below is the real /api/sazmu call.
export function Composer({initial,ai=false,apiMode,apiChatId}:{initial:DemoMsg[];ai?:boolean;apiMode?: "message"|"sazmu";apiChatId?:string}){
  const [msgs,setMsgs]=useState(initial); const [text,setText]=useState(""); const [error,setError]=useState(""); const [busy,setBusy]=useState(false);
  const send=async()=>{ if(!text.trim() || busy) return; const value=text.trim(); setError("");
   let token:string|null=null; try{ token=localStorage.getItem("communica_token"); }catch{}
   if(!token || !apiMode){ setError("Login required — your message was not sent."); return; }
   setBusy(true);
   try{
    if(apiMode==="message"){
     const res=await fetch("/api/messages",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({chatId:apiChatId,text:value,type:"TEXT"})});
     const data=await res.json(); if(!res.ok) throw new Error(data.message ?? "send failed");
     setMsgs([...msgs,{id:data.message.id,from:"You",me:true,text:value,time:"Now",status:"sent" as const}]); setText("");
    } else {
     const res=await fetch("/api/sazmu",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({text:value})});
     const data=await res.json(); if(!res.ok) throw new Error(data.message ?? "SAZMU AI reply failed");
     setMsgs(prev=>[...prev,{id:`local-${Date.now()}`,from:"You",me:true,text:value,time:"Now",status:"sent" as const},{id:`sazmu-${Date.now()}`,from:"SAZMU AI",me:false,text:data.reply.text,time:"Now",status:"sent" as const}]); setText("");
    }
   }catch(err){ setError(err instanceof Error?err.message:"send failed"); }
   setBusy(false); };
  return <div className="chat-view">
    <div className="chat-bg">{msgs.map(m=>(
      <div key={m.id} className={m.me?"bubble bubble-me":"bubble bubble-other"}><span>{m.text}</span><span className="bubble-meta">{m.time} {m.me?<Ticks status={m.status}/>:null}</span></div>))}
      {ai?<p className="ai-label">SAZMU AI replies here are template replies, not a real LLM. SAZMU AI is labelled AI, never a real human.</p>:null}
      {error?<p role="alert">Send failed: {error} — your message was not sent.</p>:null}
    </div>
    <form className="composer" onSubmit={e=>{e.preventDefault();send();}}>
      <input value={text} onChange={e=>setText(e.target.value)} placeholder={ai?"Message SAZMU AI…":"Message…"} aria-label="Message"/>
      <button type="submit" className="icon-btn icon-btn-send" aria-label="Send"><Send size={22}/></button>
    </form>
  </div>;
}
type SuggestUser={username:string;displayName:string;communicaId:string};
export function Keypad(){
  const router=useRouter();
  const [digits,setDigits]=useState("");
  const [state,setState]=useState<"idle"|"loading"|"found"|"notfound"|"own"|"login"|"error">("idle");
  const [user,setUser]=useState<SuggestUser|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [prev,setPrev]=useState<SuggestUser[]>([]);
  useEffect(()=>{ if(!getToken()) return; (async()=>{ try{ const data=await apiJson("/api/chats?filter=all") as {chats:ChatItem[]}; let me=""; try{ me=JSON.parse(localStorage.getItem("communica_user") ?? "{}").username ?? ""; }catch{} const seen=new Set<string>(); const list:SuggestUser[]=[]; data.chats.forEach((c)=>{ if(c.chat.type!=="DIRECT") return; const o=c.members.find((m)=>m.username!==me) ?? c.members[0]; if(!o||seen.has(o.username)) return; seen.add(o.username); list.push({username:o.username,displayName:o.displayName,communicaId:o.communicaId}); }); setPrev(list); }catch(err){ try{ console.warn("keypad suggestions failed", err); }catch{} } })(); },[]);
  const lookup=async(d:string)=>{
    if(d.length!==8) return;
    try{
      const me=JSON.parse(localStorage.getItem("communica_user") ?? "{}");
      if(me.communicaId===d){ setUser(null); setState("own"); return; }
    }catch{}
    if(!getToken()){ setUser(null); setState("login"); return; }
    setState("loading");
    try{
      const data=await apiJson(`/api/users/search?q=${encodeURIComponent(d)}`) as {results:SuggestUser[]};
      if(data.results.length){ setUser(data.results[0]); setState("found"); }
      else { setUser(null); setState("notfound"); }
    }catch(err){ setUser(null); setState(err instanceof Error && /unauthorized|login/i.test(err.message)?"login":"error"); }
  };
  useEffect(()=>{ if(digits.length!==8){ setState("idle"); setUser(null); setError(""); } else { void lookup(digits); } },[digits]);
  const press=(d:string)=>{ if(digits.length<8) setDigits(digits+d); };
  const startChat=async()=>{ if(!user||busy) return; setBusy(true); setError(""); try{ const data=await apiJson("/api/chats",{method:"POST",body:{type:"DIRECT",otherIdentifier:user.username}}) as {chat:{id:string;type:string}}; router.push(data.chat.type==="GROUP"?`/groups/${data.chat.id}`:`/chats/${data.chat.id}`); }catch(err){ setError(err instanceof Error?err.message:"could not start chat"); } setBusy(false); };
  const partial = digits.length>=1 && digits.length<8 ? prev.filter((u)=>u.communicaId.startsWith(digits)).slice(0,4) : [];
  return <div className="keypad2-wrap">
    {partial.length>0?<div className="keypad2-partial"><p className="keypad2-partial-label">Previously talked to — tap to fill the full ID:</p>{partial.map((u)=>(<button key={u.username} type="button" className="keypad2-partial-row" onClick={()=>setDigits(u.communicaId)}><Avatar name={u.displayName} size={40}/><span><strong>{u.displayName}</strong><span>@{u.username} • ID {u.communicaId}</span></span></button>))}</div>:null}
    {digits.length===8&&state==="loading"?<p className="keypad2-msg">Looking up…</p>:null}
    {digits.length===8&&state==="found"&&user?<div className="keypad2-suggest"><div className="keypad2-suggest-row"><Avatar name={user.displayName}/><span><strong>{user.displayName}</strong><span>@{user.username} • ID {user.communicaId}</span></span></div><div className="keypad2-actions"><button type="button" className="btn btn-green" disabled={busy} onClick={()=>void startChat()}><MessageCircle size={22}/> Message</button><Link className="btn btn-light" href={`/call?to=${encodeURIComponent(user.displayName)}&callee=${user.username}&kind=audio&variant=outgoing`}><Phone size={22}/> Call</Link><Link className="btn btn-light" href={`/call?to=${encodeURIComponent(user.displayName)}&callee=${user.username}&kind=video&variant=outgoing`}><Video size={22}/> Video</Link></div>{error?<p role="alert">{error}</p>:null}</div>:null}
    {digits.length===8&&state==="notfound"?<p className="keypad2-msg">No user with this ID.</p>:null}
    {digits.length===8&&state==="own"?<p className="keypad2-msg">This is your own ID.</p>:null}
    {digits.length===8&&state==="login"?<p className="keypad2-msg">Login to see who this ID belongs to. <Link href="/login">Login</Link></p>:null}
    {digits.length===8&&state==="error"?<p className="keypad2-msg">Lookup failed — <button type="button" className="btn btn-light" onClick={()=>void lookup(digits)}>Retry</button></p>:null}
    <p className="keypad2-number" aria-live="polite">{digits?<span>{digits}</span>:<span className="keypad2-number-empty">Enter 8-digit ID</span>}</p>
    <p className="keypad2-note">Communica ID only — not a phone number</p>
    <div className="keypad2">{["1","2","3","4","5","6","7","8","9"].map(d=>(<button key={d} type="button" className="keypad2-btn" onClick={()=>press(d)}>{d}</button>))}<span className="keypad2-empty" aria-hidden="true"/><button type="button" className="keypad2-btn" onClick={()=>press("0")}>0</button><button type="button" className="keypad2-btn" aria-label="Backspace" onClick={()=>setDigits(digits.slice(0,-1))}><Delete size={22}/></button></div>
  </div>;
}
