"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DemoNote } from "@/components/ui";
export default function LoginPage(){
 const [id,setId]=useState(""); const [pass,setPass]=useState("");
 const [error,setError]=useState(""); const [done,setDone]=useState(false); const [busy,setBusy]=useState(false);
 const submit=async(e:React.FormEvent)=>{e.preventDefault(); setError(""); setBusy(true);
  try{
   const res=await fetch("/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({identifier:id,password:pass})});
   const data=await res.json();
   if(!res.ok) throw new Error(data.message ?? "login failed");
   try{ localStorage.setItem("communica_token",data.token); localStorage.setItem("communica_user",JSON.stringify(data.user)); }catch{}
   setDone(true);
  }catch(err){ setError(err instanceof Error?err.message:"login failed"); }
  setBusy(false);};
 return <main><header className="topbar"><Link className="icon-btn" href="/" aria-label="Back"><ArrowLeft size={22}/></Link><h1>Login</h1></header>
 <div className="wrap"><form onSubmit={submit}>
  <label htmlFor="login-id">@username or Communica ID</label><input id="login-id" value={id} onChange={e=>setId(e.target.value)} placeholder="@sazzad or 8-digit ID" required/>
  <label htmlFor="login-pass">Password</label><input id="login-pass" type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder="Password" required/>
  <button className="btn btn-green btn-full" type="submit" disabled={busy}>{busy?"Logging in…":"Login"}</button>
 </form>
 {error?<><p role="alert">Login failed: {error}</p><DemoNote>Live login did not succeed, so no real login happened.</DemoNote></>:null}
 {done?<><p>Logged in.</p><Link className="btn btn-green btn-full" href="/chats">Continue to Chats</Link></>:null}
 <p><Link href="/register">Create a new account</Link></p></div></main>;
}
