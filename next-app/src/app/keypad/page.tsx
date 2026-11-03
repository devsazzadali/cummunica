import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/ui";
import { Keypad } from "@/components/interactive";
export default function KeypadPage(){
 return <AppShell active="Calls" hideHeader><header className="topbar"><Link className="icon-btn" href="/calls" aria-label="Back"><ArrowLeft size={22}/></Link><h1>Keypad</h1></header><Keypad/></AppShell>;
}
