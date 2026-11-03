"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bot, Archive, Star, LogOut, LifeBuoy } from "lucide-react";
import { AppShell, Avatar } from "@/components/ui";
import { apiJson, uploadFile } from "@/lib/api-client";
import { THEMES, applyTheme, isThemeId, type ThemeId } from "@/lib/theme";
type Profile={username:string;displayName:string;communicaId:string;bio:string|null;avatarUrl:string|null;theme:string|null};
export default function SettingsPage(){
 const [profile,setProfile]=useState<Profile|null>(null); const [name,setName]=useState(""); const [bio,setBio]=useState(""); const [error,setError]=useState(""); const [saved,setSaved]=useState(false); const [avatarBusy,setAvatarBusy]=useState(false);
 const [themeChoice,setThemeChoice]=useState<ThemeId|null>(null); const [themeSaved,setThemeSaved]=useState(false); const [themeBusy,setThemeBusy]=useState(false);
 const saveTheme=async(choice:ThemeId|null)=>{ setError(""); setThemeSaved(false); setThemeBusy(true); try{ const d=await apiJson("/api/profile",{method:"PATCH",body:{theme:choice}}) as {profile:Profile}; setProfile(d.profile); setThemeChoice(d.profile.theme && isThemeId(d.profile.theme)?d.profile.theme:null); if(choice) applyTheme(choice); else { try{ const def=await apiJson("/api/theme/default") as {theme?:string}; if(isThemeId(def.theme)) document.documentElement.setAttribute("data-theme",def.theme); }catch{} } setThemeSaved(true); }catch(err){ setError(err instanceof Error?err.message:"theme was not saved"); } setThemeBusy(false); };
 const router=useRouter();
 const changeAvatar=async(file:File)=>{ setError(""); setSaved(false); setAvatarBusy(true); try{ const up=await uploadFile(file); const d=await apiJson("/api/profile",{method:"PATCH",body:{avatarUrl:up.url}}) as {profile:Profile}; setProfile(d.profile); setSaved(true); }catch(err){ setError(err instanceof Error?err.message:"avatar was not changed"); } setAvatarBusy(false); };
 const removeAvatar=async()=>{ setError(""); setSaved(false); try{ const d=await apiJson("/api/profile",{method:"PATCH",body:{avatarUrl:""}}) as {profile:Profile}; setProfile(d.profile); setSaved(true); }catch(err){ setError(err instanceof Error?err.message:"avatar was not removed"); } };
 useEffect(()=>{ (async()=>{ try{ const d=await apiJson("/api/profile") as {profile:Profile}; setProfile(d.profile); setName(d.profile.displayName); setBio(d.profile.bio??""); setThemeChoice(d.profile.theme && isThemeId(d.profile.theme)?d.profile.theme:null); if(d.profile.theme && isThemeId(d.profile.theme)) applyTheme(d.profile.theme); }catch(err){ setError(err instanceof Error?err.message:"failed to load profile — login first"); } })(); },[]);
 const save=async(e:React.FormEvent)=>{ e.preventDefault(); setError(""); setSaved(false); try{ await apiJson("/api/profile",{method:"PATCH",body:{displayName:name,bio}}); setSaved(true); }catch(err){ setError(err instanceof Error?err.message:"profile was not saved"); } };
 const logout=async()=>{ try{ await apiJson("/api/auth/logout",{method:"POST"}); }catch{} try{ localStorage.removeItem("communica_token"); localStorage.removeItem("communica_user"); localStorage.removeItem("communica_theme"); }catch{} try{ const def=await apiJson("/api/theme/default") as {theme?:string}; document.documentElement.setAttribute("data-theme",isThemeId(def.theme)?def.theme:"p"); }catch{ document.documentElement.setAttribute("data-theme","p"); } router.push("/"); };
 return <AppShell active="Settings"><header className="topbar"><h1>Settings</h1></header>
 <div className="wrap">
  {/* F21 — avatar upload/change UI (was API-only). Uses the real
      /api/media upload path, then PATCH /api/profile avatarUrl,
      which only accepts /uploads/ URLs server-side. */}
  <div style={{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>
    {profile?.avatarUrl?<img src={profile.avatarUrl} alt="Your avatar" style={{width:80,height:80,borderRadius:"50%",objectFit:"cover"}}/>:<Avatar name={profile?.displayName??"You"} size={80}/>}
    <div><label htmlFor="set-avatar">Profile photo</label>
    <input id="set-avatar" type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={avatarBusy} onChange={(e)=>{ const f=e.target.files?.[0]; if(f) void changeAvatar(f); e.target.value=""; }}/>
    {profile?.avatarUrl?<p><button type="button" className="btn btn-light" onClick={()=>void removeAvatar()}>Remove photo</button></p>:null}
    <p className="ai-label" style={{textAlign:"left"}}>Photo uploads go through /api/media (content-sniffed, max 5 MB) and are stored server-locally.</p></div>
  </div>
  <form onSubmit={save}>
  <label htmlFor="set-name">Display name</label><input id="set-name" value={name} onChange={e=>setName(e.target.value)}/>
  <label htmlFor="set-user">@username (cannot be changed — it is how others find you)</label><input id="set-user" value={profile?`@${profile.username}`:""} readOnly/>
  <label htmlFor="set-about">About</label><input id="set-about" value={bio} onChange={e=>setBio(e.target.value)}/>
  <label htmlFor="set-id">Communica ID (read-only, generated)</label><input id="set-id" value={profile?.communicaId??""} readOnly/>
  <button className="btn btn-green btn-full" type="submit">Save profile</button></form>
  {saved?<p>Profile saved to the server.</p>:null}{error?<p role="alert">{error}</p>:null}
  {/* Theme picker (Workstream 3): name + colour preview swatches for
      all four themes, plus "Platform default" (clears the saved
      preference, so the admin-set default applies). Saving persists
      for real via PATCH /api/profile; the new theme applies
      instantly (same render) and survives logout/login because the
      DB value is re-applied after login. */}
  <h2>Theme</h2>
  <p className="ai-label" style={{textAlign:"left"}}>Choose how Communica looks. Colours, bubble shapes, buttons and headers all change together.</p>
  <div className="theme-picker" role="radiogroup" aria-label="Theme">
   {THEMES.map(t=>(
    <button key={t.id} type="button" className={themeChoice===t.id?"theme-option theme-option-selected":"theme-option"} role="radio" aria-checked={themeChoice===t.id} disabled={themeBusy} onClick={()=>void saveTheme(t.id)}>
     <span className="theme-swatches" aria-hidden="true"><i style={{background:t.header}}/><i style={{background:t.bubbleMe}}/><i style={{background:t.bubbleOther}}/></span>
     <span className="theme-option-main"><strong>{t.name}</strong><span>{t.tagline}</span></span>
     <span aria-hidden="true">{themeChoice===t.id?"✓":""}</span>
    </button>))}
   <button type="button" className={themeChoice===null?"theme-option theme-option-selected":"theme-option"} role="radio" aria-checked={themeChoice===null} disabled={themeBusy} onClick={()=>void saveTheme(null)}>
    <span className="theme-swatches" aria-hidden="true"><i style={{background:"var(--t-muted)"}}/><i style={{background:"var(--t-bubble-me)"}}/><i style={{background:"var(--t-surface)"}}/></span>
    <span className="theme-option-main"><strong>Platform default</strong><span>Follow the theme the admin set for everyone (no saved preference).</span></span>
    <span aria-hidden="true">{themeChoice===null?"✓":""}</span>
   </button>
  </div>
  {themeSaved?<p role="status">Theme saved to the server.</p>:null}
  <p style={{display:"flex",flexDirection:"column",gap:10}}>
   <Link className="btn btn-light btn-full" href="/sazmu/setup"><Bot size={22}/> SAZMU AI settings</Link>
   <Link className="btn btn-light btn-full" href="/archived"><Archive size={22}/> Archived chats</Link>
   <Link className="btn btn-light btn-full" href="/favorites"><Star size={22}/> Favorites</Link>
   <Link className="btn btn-light btn-full" href="/support"><LifeBuoy size={22}/> Support</Link>
   <button type="button" className="btn btn-danger btn-full" onClick={()=>void logout()}><LogOut size={22}/> Logout</button></p>
  <p>Logout revokes this token on the server and clears it on this device. Token hardening follow-up: move tokens to httpOnly cookies (see SECURITY.md) — until then, a token copied from this device before logout stays usable until it expires or logout is called.</p></div></AppShell>;
}
