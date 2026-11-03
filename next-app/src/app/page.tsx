import Link from "next/link";
import { MessageCircle, Phone, CircleDot, Users, Bot } from "lucide-react";
export default function HomePage(){
 return <main className="landing">
  <p className="eyebrow">Social Communication</p><h1>Communica</h1>
  <p>Chat, groups, status, communities and in-app calls — without sharing a real phone number. You get a random 8-digit Communica ID + a unique @username.</p>
  <p><strong>Inside Communica there is one AI chatbot contact: SAZMU AI</strong> — always labelled AI, never a real human.</p>
  {/* UI/UX review (WS3): ONE clear primary CTA. Register is the
      primary gradient button; Login is the secondary light button.
      The old third "Open chats" button is removed: for a logged-out
      visitor it only led to an unauthenticated error page (a dead
      end); after login, Chats is reached from the header/bottom nav. */}
  <div style={{display:"flex",flexDirection:"column",gap:12}}>
    <Link className="btn btn-pink btn-full" href="/register">Register — get started</Link>
    <Link className="btn btn-light btn-full" href="/login">Login</Link>
  </div>
  <p style={{display:"flex",gap:16,flexWrap:"wrap",marginTop:20}}><span><MessageCircle size={22}/> Chats</span><span><Phone size={22}/> In-app calls</span><span><CircleDot size={22}/> Status</span><span><Users size={22}/> Communities</span><span><Bot size={22}/> SAZMU AI (labelled AI)</span></p>
  <p className="demo-note">Real when a database is configured: register/login, chats, groups, search, status, calls and SAZMU AI setup. SAZMU AI replies are template-only until an LLM provider/key is provided — no generative reply is faked. Uploads use server storage for now; S3 is the production follow-up.</p>
 </main>;
}
