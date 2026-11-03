"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Archive, ArrowLeft } from "lucide-react";
import { AppShell, Avatar } from "@/components/ui";
import { apiJson, chatTitle, type ChatItem } from "@/lib/api-client";
export default function GroupInfoPage({params}:{params:{id:string}}){
 const [chat,setChat]=useState<ChatItem|null>(null); const [error,setError]=useState(""); const [info,setInfo]=useState(""); const [addId,setAddId]=useState("");
 const load=async()=>{ try{ const d=await apiJson("/api/chats?filter=groups") as {chats:ChatItem[]}; const f=d.chats.find(c=>c.chat.id===params.id); if(!f) throw new Error("group not found or you are not a member"); setChat(f); }catch(err){ setError(err instanceof Error?err.message:"failed to load group"); } };
 useEffect(()=>{ void load(); },[]);
 const act=async(fn:()=>Promise<unknown>,msg:string)=>{ setError(""); setInfo(""); try{ await fn(); setInfo(msg); await load(); }catch(err){ setError(err instanceof Error?err.message:"action failed"); } };
 const meId=(()=>{ try{ return JSON.parse(localStorage.getItem("communica_user")??"{}").id??""; }catch{ return ""; } })();
 const myRole=chat?.members.find(m=>m.userId===meId)?.role;
 return <AppShell active="Chats"><header className="topbar"><Link className="icon-btn" href={`/groups/${params.id}`} aria-label="Back"><ArrowLeft size={22}/></Link><h1>Group Info</h1></header>
 {chat?<><div className="wrap" style={{textAlign:"center"}}><Avatar name={chatTitle(chat)} group size={80}/><h2>{chatTitle(chat)}</h2><p>{chat.members.length} members{myRole?` · you are ${myRole}`:""}</p></div>
 <div className="wrap"><h3>Members</h3><ul>{chat.members.map(m=>(<li key={m.userId}>{m.displayName} (@{m.username}) · {m.role}{myRole==="ADMIN"&&m.userId!==meId?<span> <button type="button" className="btn btn-light" style={{minHeight:44,padding:"10px 14px"}} onClick={()=>void act(()=>apiJson("/api/chats/members",{method:"PATCH",body:{chatId:params.id,userId:m.userId,role:m.role==="ADMIN"?"MEMBER":"ADMIN"}}),"Role changed")}>Make {m.role==="ADMIN"?"member":"admin"}</button> <button type="button" className="btn btn-light" style={{minHeight:44,padding:"10px 14px"}} onClick={()=>void act(()=>apiJson(`/api/chats/members?chatId=${params.id}&userId=${m.userId}`,{method:"DELETE"}),"Member removed")}>Remove</button></span>:null}</li>))}</ul>
  {myRole==="ADMIN"?<><label htmlFor="add-member">Add member by @username or 8-digit ID</label><input id="add-member" value={addId} onChange={e=>setAddId(e.target.value)} placeholder="@username or 8-digit ID"/><p><button type="button" className="btn btn-green btn-full" onClick={()=>void act(()=>apiJson("/api/chats/members",{method:"POST",body:{chatId:params.id,identifier:addId}}),"Member added")}>Add member</button></p></>:<p>Only group admins can add members or change roles.</p>}
  <p style={{display:"flex",gap:8,flexWrap:"wrap"}}><button type="button" className="btn btn-light" onClick={()=>void act(()=>apiJson("/api/chats",{method:"PATCH",body:{chatId:params.id,archived:true}}),"Group archived")}>Archive this group</button><button type="button" className="btn btn-danger" onClick={()=>void act(()=>apiJson(`/api/chats/members?chatId=${params.id}`,{method:"DELETE"}),"You left the group")}>Leave group</button></p>
  {info?<p>{info}</p>:null}{error?<p role="alert">{error}</p>:null}
  <p><Link className="btn btn-light btn-full" href={`/groups/${params.id}`}><Archive size={22}/> Back to group</Link></p></div></>:<div className="wrap">{error?<p role="alert">{error}</p>:<p className="empty">Loading group…</p>}</div>}</AppShell>;
}
