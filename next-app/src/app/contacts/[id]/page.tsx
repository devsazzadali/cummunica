"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessageCircle, Phone, Video, Star, Archive, Ban, Flag, ArrowLeft } from "lucide-react";
import { AppShell, Avatar } from "@/components/ui";
import { apiJson } from "@/lib/api-client";
type U={username:string;displayName:string;communicaId:string;bio:string|null;avatarUrl:string|null};
export default function ContactPage({params}:{params:{id:string}}){
 const router=useRouter();
 const [user,setUser]=useState<U|null>(null); const [error,setError]=useState(""); const [info,setInfo]=useState(""); const [copied,setCopied]=useState(false);
 const [myAccepted,setMyAccepted]=useState<boolean|null>(null);
 useEffect(()=>{ (async()=>{ try{ const d=await apiJson("/api/contacts") as {contacts:{username:string;accepted:boolean}[]}; const row=d.contacts.find(r=>r.username===params.id); setMyAccepted(row?row.accepted:null); }catch{} })(); },[params.id]);
 const acceptContact=async()=>{ if(!user) return; await act(async()=>{ await apiJson("/api/contacts",{method:"POST",body:{identifier:user.username}}).catch(()=>{}); await apiJson("/api/contacts",{method:"PATCH",body:{identifier:user.username,accepted:true}}); setMyAccepted(true); },"Accepted — this person can now call you."); };
 const copyId=async()=>{ if(!user) return; try{ await navigator.clipboard.writeText(user.communicaId); setCopied(true); setTimeout(()=>setCopied(false),2000); }catch{ setError("Could not copy — long-press the ID to copy it manually."); } };
 useEffect(()=>{ (async()=>{ try{ const d=await apiJson(`/api/users/search?q=${encodeURIComponent(params.id)}`) as {results:U[]}; const f=d.results.find(r=>r.username===params.id||r.communicaId===params.id)??d.results[0]; if(!f) throw new Error("contact not found — search by exact @username or 8-digit ID"); setUser(f); }catch(err){ setError(err instanceof Error?err.message:"failed to load contact"); } })(); },[params.id]);
 const act=async(fn:()=>Promise<unknown>,msg:string)=>{ setError(""); setInfo(""); try{ await fn(); setInfo(msg); }catch(err){ setError(err instanceof Error?err.message:"action failed"); } };
 const message=async()=>{ if(!user) return; try{ const d=await apiJson("/api/chats",{method:"POST",body:{type:"DIRECT",otherIdentifier:user.username}}) as {chat:{id:string}}; router.push(`/chats/${d.chat.id}`); }catch(err){ setError(err instanceof Error?err.message:"could not open chat"); } };
 const ensureContact=async()=>{ if(!user) return; await apiJson("/api/contacts",{method:"POST",body:{identifier:user.username}}).catch(()=>{}); };
 const archive=async()=>{ if(!user) return; const d=await apiJson("/api/chats",{method:"POST",body:{type:"DIRECT",otherIdentifier:user.username}}) as {chat:{id:string}}; await apiJson("/api/chats",{method:"PATCH",body:{chatId:d.chat.id,archived:true}}); };
 const name=user?.displayName??"Contact";
 return <AppShell requireLogin active="Chats"><header className="topbar"><Link className="icon-btn" href="/chats" aria-label="Back"><ArrowLeft size={22}/></Link><h1>Contact Profile</h1></header>
 {user?<><div className="wrap" style={{textAlign:"center"}}>{user.avatarUrl?<img src={user.avatarUrl} alt={`${name} photo`} style={{width:80,height:80,borderRadius:"50%",objectFit:"cover"}}/>:<Avatar name={name} size={80}/>}<h2>{name}</h2><p>@{user.username}</p><p>Communica ID {user.communicaId} <button type="button" className="btn btn-light" style={{minHeight:44,padding:"10px 14px"}} onClick={()=>void copyId()}>{copied?"Copied":"Copy ID"}</button></p><p>In-app ID only — not a phone number</p>{user.bio?<><h3>About</h3><p>{user.bio}</p></>:<p>About: not set yet.</p>}</div>
 <div className="wrap" style={{display:"flex",flexDirection:"column",gap:10}}>
  {myAccepted===false?<button type="button" className="btn btn-green btn-full" onClick={()=>void acceptContact()}><MessageCircle size={22}/> Accept as contact</button>:myAccepted===true?<p role="status">You have accepted this contact — they can now call you.</p>:null}
  <button type="button" className="btn btn-light btn-full" onClick={()=>void message()}><MessageCircle size={22}/> Message</button>
  <Link className="btn btn-light btn-full" href={`/call?to=${encodeURIComponent(name)}&callee=${user.username}&kind=audio&variant=outgoing`}><Phone size={22}/> Audio call (in-app only)</Link>
  <Link className="btn btn-light btn-full" href={`/call?to=${encodeURIComponent(name)}&callee=${user.username}&kind=video&variant=outgoing`}><Video size={22}/> Video call (in-app only)</Link>
  <button type="button" className="btn btn-light btn-full" onClick={()=>void act(async()=>{ await ensureContact(); await apiJson("/api/contacts",{method:"PATCH",body:{identifier:user.username,isFavorite:true}}); },"Added to favourites") }><Star size={22}/> Add to Favorites</button>
  <button type="button" className="btn btn-light btn-full" onClick={()=>void act(archive,"Chat archived")}><Archive size={22}/> Archive this chat</button>
  <button type="button" className="btn btn-light btn-full" onClick={()=>void act(async()=>{ await ensureContact(); await apiJson("/api/contacts",{method:"PATCH",body:{identifier:user.username,isBlocked:true}}); },"Contact blocked — their messages and calls are refused by the server")}><Ban size={22}/> Block contact</button>
  <button type="button" className="btn btn-light btn-full" onClick={()=>void act(async()=>{ await ensureContact(); await apiJson("/api/contacts",{method:"PATCH",body:{identifier:user.username,isBlocked:true}}); },"Reported and blocked. There is no moderation review queue yet — that is pending, so blocking is the enforced action today.")}><Flag size={22}/> Report contact</button>
  {info?<p>{info}</p>:null}{error?<p role="alert">{error}</p>:null}
 </div></>:<div className="wrap">{error?<><p role="alert">{error}</p>{error==="unauthenticated"?<p><Link className="btn btn-green btn-full" href="/login">Login</Link></p>:null}</>:<p className="empty">Loading contact…</p>}</div>}</AppShell>;
}
