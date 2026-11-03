import Link from "next/link";
import { MessageCircle, PhoneCall, Sparkles, ArrowLeft } from "lucide-react";

/** Shared premium brand panel for /login and /register. Display only. */
export function AuthBrandPanel() {
  return (
    <aside className="auth-brand" aria-label="About Communica">
      <Link className="auth-back" href="/" aria-label="Back to home">
        <ArrowLeft size={20} /> Back
      </Link>
      <p className="auth-wordmark">Communica</p>
      <p className="auth-tagline">Stay close to the people who matter — chats, calls and your AI companion in one place.</p>
      <ul className="auth-features">
        <li><span className="auth-feature-icon"><MessageCircle size={20} /></span><span><strong>Chats</strong><br />Fast, private messaging with friends and groups.</span></li>
        <li><span className="auth-feature-icon"><PhoneCall size={20} /></span><span><strong>Calls</strong><br />Clear audio and video calls, right inside the app.</span></li>
        <li><span className="auth-feature-icon"><Sparkles size={20} /></span><span><strong>SAZMU AI</strong> <span className="auth-ai-badge">AI</span><br />Your supportive AI companion, always labelled as AI.</span></li>
      </ul>
      <p className="auth-brand-foot">No real phone number is needed — you get an in-app Communica ID.</p>
    </aside>
  );
}
