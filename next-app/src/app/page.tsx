import Link from "next/link";
import { MessageCircle, Phone, CircleDot, Users, Bot, ShieldCheck, KeyRound, EyeOff } from "lucide-react";
// Premium landing 2026-11-03: replaces the old plain centred column.
// UI/UX rules kept: ONE clear primary CTA (Register, gradient);
// Login is secondary only. No invented social proof, no user counts,
// no claimed features: every trust line below is already true in code
// (no real phone number, admins cannot read private chats, SAZMU AI
// is labelled AI and template-only until an LLM provider/key is set).
// All colours come from --t-* theme variables only — no hardcoded
// hex in this page or its landing-v2 CSS — so the page follows the
// platform default theme (V) and any future default change.
export default function HomePage(){
 return <main className="landing landing-v2">
  <nav className="landing-nav" aria-label="Main">
    <span className="landing-brand"><span className="landing-logo" aria-hidden="true">C</span> Communica</span>
    <Link className="btn btn-light landing-nav-login" href="/login">Login</Link>
  </nav>
  <section className="landing-hero">
    <div className="landing-hero-copy">
      <p className="eyebrow">Social Communication</p>
      <h1>Stay close, without sharing your real phone number.</h1>
      <p className="landing-sub">Chat, groups, status, communities and in-app calls in one place. You get a random 8-digit Communica ID + a unique @username — that is how people find you inside Communica.</p>
      <p className="landing-ai"><Bot size={20} aria-hidden="true" /> <span>Inside Communica there is one AI chatbot contact: <strong>SAZMU AI</strong> — always labelled AI, never a real human.</span></p>
      <div className="landing-cta">
        <Link className="btn btn-pink" href="/register">Register — get started</Link>
        <Link className="btn btn-light" href="/login">Login</Link>
      </div>
      <p className="landing-micro">Registration first, then use. No real phone number is needed.</p>
    </div>
    <div className="landing-mock" aria-hidden="true">
      <div className="landing-mock-header"><span className="landing-mock-avatar">S</span><span><strong>Sazzad</strong><span className="landing-mock-status">Online</span></span><Phone size={20} /></div>
      <div className="landing-mock-body">
        <p className="landing-bubble-other">Hi! Are we still on for tonight?</p>
        <p className="landing-bubble-me">Yes! Call me in the app when you are free.</p>
        <p className="landing-bubble-ai"><Bot size={16} /> SAZMU AI · I can help you plan it — just ask me in chat.</p>
      </div>
      <div className="landing-mock-input"><span>Message…</span><span className="landing-mock-send">➤</span></div>
    </div>
  </section>
  <section className="landing-features" aria-label="Features">
    <div className="landing-card"><MessageCircle size={26} aria-hidden="true" /><h2>Chats &amp; groups</h2><p>One-to-one chats and groups, with photos, voice and files, reactions, archive and favourites.</p></div>
    <div className="landing-card"><Phone size={26} aria-hidden="true" /><h2>In-app calls</h2><p>Audio and video calls inside the app only — never phone calls, never your real number.</p></div>
    <div className="landing-card"><CircleDot size={26} aria-hidden="true" /><h2>Status &amp; communities</h2><p>Share status updates and join communities around the people and topics you care about.</p></div>
    <div className="landing-card"><Users size={26} aria-hidden="true" /><h2>Find people by ID or @username</h2><p>Search by the exact 8-digit Communica ID or by @username. Partial IDs are deliberately not supported.</p></div>
  </section>
  <section className="landing-trust" aria-label="Privacy">
    <p><ShieldCheck size={20} aria-hidden="true" /> Admins and support cannot read your private chats.</p>
    <p><KeyRound size={20} aria-hidden="true" /> Your Communica ID is not a phone number and cannot place or receive phone calls.</p>
    <p><EyeOff size={20} aria-hidden="true" /> SAZMU AI replies are template-only until an LLM provider/key is provided — no generative reply is faked.</p>
  </section>
  <p className="demo-note">Real when a database is configured: register/login, chats, groups, search, status, calls and SAZMU AI setup. Uploads use server storage for now; S3 is the production follow-up.</p>
  <footer className="landing-footer"><Link href="/support">Support</Link><Link href="/register">Register</Link><Link href="/login">Login</Link></footer>
 </main>;
}
