"use client";
import { useEffect, useState } from "react";
import { Phone, PhoneOff } from "lucide-react";
import { apiJson, getToken, type ChatItem } from "@/lib/api-client";
import { startRingtone, vibrateIncoming } from "@/lib/sound";
import { Avatar } from "@/components/ui";

type Incoming = { callId: string; callerId: string; type: string; chatId: string | null };

// FULLSCREEN incoming-call overlay (2026-11-03, user complaint).
// The old banner was a tiny strip at the bottom of the sidebar rail
// with only a small text link to tap and a Decline button — no
// Accept button, no ringtone, no fullscreen screen. Users could not
// find or receive the call from it. This overlay covers the whole
// screen, rings, vibrates, and shows big Accept / Decline buttons.
// Accept navigates to the /call screen and auto-accepts there
// (sessionStorage flag, cleared on use); Decline rejects via API.
// Outgoing / already-accepted calls are NOT shown here: CallScreen
// cannot resume a WebRTC peer after unmount, so a banner for those
// would be fake.
export function CallBanner() {
  const [call, setCall] = useState<Incoming | null>(null);
  const [name, setName] = useState("");
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.pathname.startsWith("/call")) return;
    if (!getToken()) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const data = await apiJson("/api/calls?incoming=1") as { incoming: Incoming[] };
        if (cancelled) return;
        const first = data.incoming[0] ?? null;
        setCall(first);
        if (first) {
          try {
            const chats = await apiJson("/api/chats") as { chats: ChatItem[] };
            const member = chats.chats.flatMap((c) => c.members).find((m) => m.userId === first.callerId);
            if (!cancelled) setName(member ? member.displayName : "");
          } catch { if (!cancelled) setName(""); }
        }
      } catch { if (!cancelled) setCall(null); }
    };
    void poll();
    const t = setInterval(poll, 5000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);
  useEffect(() => {
    if (!call) return;
    const stop = startRingtone();
    vibrateIncoming();
    return () => { stop(); };
  }, [call]);
  if (!call) return null;
  const kind = call.type === "VIDEO" ? "video" : "audio";
  const href = `/call?variant=incoming&callId=${encodeURIComponent(call.callId)}&kind=${kind}&to=${encodeURIComponent(name || "Incoming call")}`;
  const displayName = name || "Someone";
  return (
    <div className="call-banner-full" role="alert" aria-label={`Incoming ${kind} call from ${displayName}`}>
      <Avatar name={displayName} size={140} />
      <h2>{displayName}</h2>
      <p className="call-incoming-label">Incoming {kind} call</p>
      <p className="call-timer">Tap Accept to answer now.</p>
      <div className="call-answer-big">
        <button
          type="button"
          className="call-big-btn call-big-accept"
          aria-label="Accept call"
          onClick={() => {
            try { sessionStorage.setItem("communica_auto_accept", call.callId); } catch {}
            window.location.assign(href);
          }}
        >
          <Phone size={36} /><span>Accept</span>
        </button>
        <button
          type="button"
          className="call-big-btn call-big-decline"
          aria-label="Decline call"
          onClick={async () => { try { await apiJson("/api/calls", { method: "POST", body: { action: "decline", callId: call.callId } }); } catch {} setCall(null); }}
        >
          <PhoneOff size={36} /><span>Decline</span>
        </button>
      </div>
      <p className="call-timer">In-app call only — not a phone call.</p>
    </div>
  );
}
