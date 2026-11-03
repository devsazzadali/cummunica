import Link from "next/link";
import { MessageCircle, CircleDot, Users, Phone, Settings, Check, CheckCheck, Star, Search, ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { initials } from "@/lib/demo-data"; // initials() only — no demo users/chats are rendered anywhere now.
const AVATAR_VARIANTS=["avatar-c-green","avatar-c-purple","avatar-c-amber","avatar-c-pink","avatar-c-teal"];
function avatarVariant(name:string){let h=0;for(const c of name)h=(h*31+c.charCodeAt(0))>>>0;return AVATAR_VARIANTS[h%AVATAR_VARIANTS.length];}
export function Avatar({name,ai=false,group=false,size=50}:{name:string;ai?:boolean;group?:boolean;size?:number}){
  return <span className={ai?"avatar avatar-ai":group?"avatar avatar-group":`avatar ${avatarVariant(name)}`} style={{width:size,height:size,fontSize:size>50?22:16}} aria-hidden="true">{ai?"AI":group?initials(name).slice(0,1):initials(name)}</span>;
}
export function Ticks({status}:{status?:"sent"|"delivered"|"read"}){
  if(status==="read") return <CheckCheck size={16} className="tick tick-read" aria-label="Read" />;
  if(status==="delivered") return <CheckCheck size={16} className="tick" aria-label="Delivered" />;
  return <Check size={16} className="tick" aria-label="Sent" />;
}
export function DemoNote({children}:{children?:ReactNode}){
  return <p className="demo-note" role="note">{children ?? "Note: if a live action failed, nothing was saved — the error above is the real result."}</p>;
}
export function TopBar({title,back,actions}:{title:string;back?:string;actions?:ReactNode}){
  return <header className="topbar">{back?<Link className="icon-btn" href={back} aria-label="Back"><ArrowLeft size={22}/></Link>:null}<h1>{title}</h1><div className="topbar-actions">{actions}</div></header>;
}
export const NAV=[{href:"/chats",label:"Chats",Icon:MessageCircle},{href:"/updates",label:"Updates",Icon:CircleDot},{href:"/communities",label:"Communities",Icon:Users},{href:"/calls",label:"Calls",Icon:Phone},{href:"/settings",label:"Settings",Icon:Settings}];
export function BottomNav({active}:{active:string}){
  return <nav className="bottom-nav" aria-label="Main tabs">{NAV.map(({href,label,Icon})=>(
    <Link key={href} href={href} className={active===label?"nav-item nav-active":"nav-item"} aria-current={active===label?"page":undefined}><Icon size={22} strokeWidth={2}/><span>{label}</span></Link>))}</nav>;
}
export function DesktopTabs({active}:{active:string}){
  return <nav className="desktop-tabs" aria-label="Main tabs">{NAV.map(({href,label,Icon})=>(
    <Link key={href} href={href} className={active===label?"dtab dtab-active":"dtab"}><Icon size={22} strokeWidth={2}/>{label}</Link>))}</nav>;
}
export function SearchBar({placeholder,href}:{placeholder:string;href?:string}){
  return <div className="search-bar"><Search size={22}/><span>{placeholder}</span>{href?<Link className="search-link" href={href}>Open</Link>:null}</div>;
}
export function TwoPane({list,detail,listHideMobile}:{list:ReactNode;detail:ReactNode;listHideMobile?:boolean}){
  return <div className="two-pane"><aside className={listHideMobile?"pane-list pane-list-hide-mobile":"pane-list"}>{list}</aside><section className="pane-detail">{detail}</section></div>;
}
export function AppShell({active,title,children,back,hideHeader}:{active:string;title?:string;children:ReactNode;back?:string;hideHeader?:boolean}){
  return <div className="app-shell">
    <header className={hideHeader?"app-header app-header-hide-mobile":"app-header"}><Link className="brand" href="/chats">Communica</Link><DesktopTabs active={active}/>{title?<span className="app-title">{title}</span>:null}</header>
    <main className="app-main">{children}</main>
    <BottomNav active={active}/>
  </div>;
}
export function SimpleShell({active,children}:{active:string;children:ReactNode}){
  return <div className="app-shell"><header className="app-header"><Link className="brand" href="/chats">Communica</Link><DesktopTabs active={active}/></header><main className="app-main">{children}</main><BottomNav active={active}/></div>;
}
