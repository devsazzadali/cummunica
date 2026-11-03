"use client";
import { useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, LifeBuoy, LogIn } from "lucide-react";
import { DemoNote } from "@/components/ui";
import { AuthBrandPanel } from "@/components/auth-brand";
import { applyTheme, isThemeId, DEFAULT_THEME } from "@/lib/theme";
// After login, the DB theme wins over any stale mirror: fetch the
// profile theme (never blocks the login success on failure) and
// apply it; otherwise fall back to the platform default.
async function applyThemeAfterAuth(token: string) {
  try {
    const res = await fetch("/api/profile", { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json().catch(() => ({}));
    if (res.ok && isThemeId((data as { profile?: { theme?: unknown } }).profile?.theme)) {
      applyTheme((data as { profile: { theme: "p" | "v" | "c" | "d" } }).profile.theme);
      return;
    }
  } catch { /* fall through to default */ }
  try {
    const res = await fetch("/api/theme/default");
    const data = await res.json().catch(() => ({}));
    if (isThemeId((data as { theme?: unknown }).theme)) applyTheme((data as { theme: "p" | "v" | "c" | "d" }).theme);
    else applyTheme(DEFAULT_THEME);
  } catch { /* keep current theme */ }
}
export default function LoginPage(){
 const [id,setId]=useState(""); const [pass,setPass]=useState(""); const [showPass,setShowPass]=useState(false);
 const [error,setError]=useState(""); const [done,setDone]=useState(false); const [busy,setBusy]=useState(false);
 const submit=async(e:React.FormEvent)=>{e.preventDefault(); setError(""); setBusy(true);
  try{
   const res=await fetch("/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({identifier:id,password:pass})});
   const data=await res.json();
   if(!res.ok) throw new Error(data.message ?? "login failed");
   try{ localStorage.setItem("communica_token",data.token); localStorage.setItem("communica_user",JSON.stringify(data.user)); }catch{}
   await applyThemeAfterAuth(data.token);
   setDone(true);
  }catch(err){ setError(err instanceof Error?err.message:"login failed"); }
  setBusy(false);};
 return <div className="auth-shell"><AuthBrandPanel />
 <main className="auth-main"><div className="auth-card">
  <h1>Welcome back</h1><p className="auth-sub">Login to continue your chats and calls.</p>
  <form onSubmit={submit}>
   <label htmlFor="login-id">@username or Communica ID</label><input id="login-id" value={id} onChange={e=>setId(e.target.value)} placeholder="@sazzad or 8-digit ID" required/>
   <label htmlFor="login-pass">Password</label>
   <div className="auth-field"><input id="login-pass" type={showPass?"text":"password"} value={pass} onChange={e=>setPass(e.target.value)} placeholder="Password" required/>
   <button className="auth-pw-toggle" type="button" onClick={()=>setShowPass(v=>!v)} aria-label={showPass?"Hide password":"Show password"}>{showPass?<EyeOff size={20}/>:<Eye size={20}/>}</button></div>
   <button className="btn btn-pink btn-full" style={{marginTop:20}} type="submit" disabled={busy}><LogIn size={18}/>{busy?"Logging in…":"Login"}</button>
  </form>
  {error?<><p className="auth-error" role="alert">Login failed: {error}</p><DemoNote>Live login did not succeed, so no real login happened.</DemoNote></>:null}
  {done?<><p className="auth-success">Logged in.</p><Link className="btn btn-pink btn-full" href="/chats">Continue to Chats</Link></>:null}
  <p className="auth-switch">New to Communica? <Link href="/register">Create a new account</Link></p>
  <p className="auth-help"><LifeBuoy size={14} style={{verticalAlign:"middle"}}/> Need help? <Link href="/support">Visit Support</Link></p>
 </div></main></div>;
}
