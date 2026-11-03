import Link from "next/link";
import { AppShell, TwoPane } from "@/components/ui";
import { RealChat, RealChatList } from "@/components/real-chat";
export default function ChatPage({params}:{params:{id:string}}){
 const list=<div><RealChatList activeId={params.id}/></div>;
 return <AppShell requireLogin active="Chats" hideHeader hideBottomNav><TwoPane list={list} listHideMobile detail={<RealChat chatId={params.id} group={false}/>}/></AppShell>;
}
