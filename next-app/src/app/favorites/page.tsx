import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/ui";
import { RealChatList } from "@/components/real-chat";
export default function FavoritesPage(){
 return <AppShell requireLogin active="Chats"><header className="topbar"><Link className="icon-btn" href="/chats" aria-label="Back"><ArrowLeft size={22}/></Link><h1>Favorites</h1></header><RealChatList filter="favorites"/><div className="wrap"><Link className="btn btn-light btn-full" href="/chats">Back to Chats</Link></div></AppShell>;
}
