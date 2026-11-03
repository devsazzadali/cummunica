import Link from "next/link";
import { AppShell, TwoPane } from "@/components/ui";
import { RealChat, RealChatList } from "@/components/real-chat";
export default function GroupPage({params}:{params:{id:string}}){
 const list=<div><header className="topbar"><h1>Communica</h1></header><RealChatList filter="groups" activeId={params.id}/><div className="wrap"><Link className="btn btn-light btn-full" href="/chats">Back to Chats</Link></div></div>;
 return <AppShell active="Chats"><TwoPane list={list} listHideMobile detail={<RealChat chatId={params.id} group={true}/>}/></AppShell>;
}
