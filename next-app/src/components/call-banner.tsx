"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { PhoneOff, VolumeX } from "lucide-react";
import { apiJson, getToken, type ChatItem } from "@/lib/api-client";

type Incoming = { callId: string; callerId: string; type: string; chatId: string | null };

// Top banner for a RINGING incoming call only (GET /api/calls?incoming=1).
// Tapping returns to the incoming call screen (Accept / Decline there);
// the red button declines via the real API. Outgoing / already-accepted
// calls are NOT shown here: CallScreen cannot resume a WebRTC peer after
// unmount, so a banner for those would be fake. That resume work is Phase 3.
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
  if (!call) return null;
  const kind = call.type === "VIDEO" ? "video" : "audio";
  const href = `/call?variant=incoming&callId=${encodeURIComponent(call.callId)}&kind=${kind}&to=${encodeURIComponent(name || "Incoming call")}`;
  return (
    <div className="call-banner">
      <VolumeX size={22} aria-hidden="true" />
      <Link href={href}>{name ? `${name} — Ringing` : "Incoming call — Ringing"}</Link>
      <button
        type="button"
        className="call-banner-end"
        aria-label="Decline call"
        onClick={async () => { try { await apiJson("/api/calls", { method: "POST", body: { action: "decline", callId: call.callId } }); } catch {} setCall(null); }}
      >
        <PhoneOff size={22} />
      </button>
    </div>
  );
}
