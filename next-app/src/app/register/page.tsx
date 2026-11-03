"use client";
import { useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, LifeBuoy, UserPlus } from "lucide-react";
import { DemoNote } from "@/components/ui";
import { AuthBrandPanel } from "@/components/auth-brand";
import { applyTheme, isThemeId, DEFAULT_THEME } from "@/lib/theme";
// New accounts have no saved theme: apply the platform default
// (never blocks the registration success on failure).
async function applyDefaultThemeAfterAuth() {
  try {
    const res = await fetch("/api/theme/default");
    const data = await res.json().catch(() => ({}));
    if (isThemeId((data as { theme?: unknown }).theme)) applyTheme((data as { theme: "p" | "v" | "c" | "d" }).theme);
    else applyTheme(DEFAULT_THEME);
  } catch { /* keep current theme */ }
}
export default function RegisterPage(){
 const [name,setName]=useState(""); const [user,setUser]=useState(""); const [pass,setPass]=useState(""); const [showPass,setShowPass]=useState(false);
 const [error,setError]=useState(""); const [done,setDone]=useState<{communicaId:string}|null>(null); const [busy,setBusy]=useState(false);
 const submit=async(e:React.FormEvent)=>{e.preventDefault(); setError(""); setBusy(true);
  try{
   const res=await fetch("/api/auth/register",{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({displayName:name,username:user.trim().replace(/^@/,""),password:pass})});
   const data=await res.json();
   if(!res.ok) throw new Error(data.message ?? "registration failed");
   try{ localStorage.setItem("communica_token",data.token); localStorage.setItem("communica_user",JSON.stringify(data.user)); }catch{}
   await applyDefaultThemeAfterAuth();
   setDone({communicaId:data.communicaId});
  }catch(err){ setError(err instanceof Error?err.message:"registration failed"); }
  setBusy(false);};
 return <div className="auth-shell"><AuthBrandPanel />
 <main className="auth-main"><div className="auth-card">
  <h1>Create your account</h1><p className="auth-sub">Registration first, then use. No real phone number is needed.</p>
  <form onSubmit={submit}>
   <label htmlFor="reg-name">Display name</label><input id="reg-name" value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Sazzad" required/>
   <label htmlFor="reg-user">Unique @username</label><input id="reg-user" value={user} onChange={e=>setUser(e.target.value)} placeholder="e.g. @sazzad" required/>
   <label htmlFor="reg-pass">Password (at least 8 characters)</label>
   <div className="auth-field"><input id="reg-pass" type={showPass?"text":"password"} value={pass} onChange={e=>setPass(e.target.value)} placeholder="Password" required/>
   <button className="auth-pw-toggle" type="button" onClick={()=>setShowPass(v=>!v)} aria-label={showPass?"Hide password":"Show password"}>{showPass?<EyeOff size={20}/>:<Eye size={20}/>}</button></div>
   <button className="btn btn-pink btn-full" style={{marginTop:20}} type="submit" disabled={busy}><UserPlus size={18}/>{busy?"Creating…":"Create account"}</button>
  </form>
  {error?<><p className="auth-error" role="alert">Registration failed: {error}</p><DemoNote>Live registration did not succeed, so no account was created. No account was created.</DemoNote></>:null}
  {done?<><p className="auth-success">Account created. Your Communica ID is <strong>{done.communicaId}</strong> — this 8-digit in-app ID is not a phone number.</p><Link className="btn btn-pink btn-full" href="/chats">Continue to Chats</Link></>:null}
  <p className="auth-switch">Already have an account? <Link href="/login">Login</Link></p>
  <p className="auth-help"><LifeBuoy size={14} style={{verticalAlign:"middle"}}/> Need help? <Link href="/support">Visit Support</Link></p>
 </div></main></div>;
}
