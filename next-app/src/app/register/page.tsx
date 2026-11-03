"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DemoNote } from "@/components/ui";
export default function RegisterPage(){
 const [name,setName]=useState(""); const [user,setUser]=useState(""); const [pass,setPass]=useState("");
 const [error,setError]=useState(""); const [done,setDone]=useState<{communicaId:string}|null>(null); const [busy,setBusy]=useState(false);
 const submit=async(e:React.FormEvent)=>{e.preventDefault(); setError(""); setBusy(true);
  try{
   const res=await fetch("/api/auth/register",{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({displayName:name,username:user.trim().replace(/^@/,""),password:pass})});
   const data=await res.json();
   if(!res.ok) throw new Error(data.message ?? "registration failed");
   try{ localStorage.setItem("communica_token",data.token); localStorage.setItem("communica_user",JSON.stringify(data.user)); }catch{}
   setDone({communicaId:data.communicaId});
  }catch(err){ setError(err instanceof Error?err.message:"registration failed"); }
  setBusy(false);};
 return <main><header className="topbar"><Link className="icon-btn" href="/" aria-label="Back"><ArrowLeft size={22}/></Link><h1>Register</h1></header>
 <div className="wrap"><p>Registration first, then use. No real phone number is needed.</p>
 <form onSubmit={submit}>
  <label htmlFor="reg-name">Display name</label><input id="reg-name" value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Sazzad" required/>
  <label htmlFor="reg-user">Unique @username</label><input id="reg-user" value={user} onChange={e=>setUser(e.target.value)} placeholder="e.g. @sazzad" required/>
  <label htmlFor="reg-pass">Password (at least 8 characters)</label><input id="reg-pass" type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder="Password" required/>
  <button className="btn btn-green btn-full" type="submit" disabled={busy}>{busy?"Creating…":"Create account"}</button>
 </form>
 {error?<><p role="alert">Registration failed: {error}</p><DemoNote>Live registration did not succeed, so no account was created. No account was created.</DemoNote></>:null}
 {done?<><p>Account created. Your Communica ID is <strong>{done.communicaId}</strong> — this 8-digit in-app ID is not a phone number.</p><Link className="btn btn-green btn-full" href="/chats">Continue to Chats</Link></>:null}
 <p>Already have an account? <Link href="/login">Login</Link></p></div></main>;
}
