"use client";
import { useState } from "react";
import Link from "next/link";
import { Send, Delete, Phone } from "lucide-react";
import { Ticks, DemoNote } from "@/components/ui";
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
export function Keypad(){
  const [digits,setDigits]=useState("");
  return <div className="keypad-wrap"><p className="keypad-number" aria-live="polite">{digits||"Enter 8-digit ID"}</p>
    <p>Dial an 8-digit in-app Communica ID. This is NOT a phone number and never dials a real phone.</p>
    <div className="keypad">{["1","2","3","4","5","6","7","8","9","*","0","#"].map(d=>(<button key={d} type="button" onClick={()=>digits.length<8&&setDigits(digits+d)}>{d}</button>))}</div>
    <div className="keypad-actions"><button type="button" className="btn btn-light" onClick={()=>setDigits(digits.slice(0,-1))}><Delete size={22}/> Backspace</button><button type="button" className="btn btn-light" onClick={()=>setDigits("")}>Clear</button></div>
    {digits.length===8?<Link className="btn btn-green" href={`/call?to=${digits}&callee=${digits}&kind=audio&variant=outgoing`}><Phone size={22}/> Call this Communica ID (in-app only)</Link>:<DemoNote>Enter exactly 8 digits to enable the call button. Partial ID search is not supported.</DemoNote>}
  </div>;
}
