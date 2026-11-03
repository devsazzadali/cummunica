import { AppShell } from "@/components/ui";
import { CallScreen } from "@/components/call-ui";
// Step 4: real in-browser WebRTC call screen. Query params:
//   to      — display name (shown in the header; resolved to a real
//             user for outgoing calls when no callee is given)
//   callee  — 8-digit Communica ID or username to actually dial
//   kind    — audio | video
//   variant — outgoing | incoming
//   callId  — an existing ringing call (incoming accept/decline)
// An outgoing call without a signed-in user, without a resolvable
// real user, or to a not-accepted contact shows a plain gated error
// — never a simulated timer presented as a real call.
export default function CallPage({ searchParams }: { searchParams: { to?: string; kind?: string; variant?: string; callee?: string; callId?: string } }) {
  const name = searchParams.to ?? "Unknown";
  const kind = searchParams.kind === "video" ? "video" : "audio";
  const variant = searchParams.variant === "incoming" ? "incoming" : "outgoing";
  return <AppShell active="Calls" hideHeader hideBottomNav><CallScreen name={name} kind={kind} variant={variant} callee={searchParams.callee} callId={searchParams.callId} /></AppShell>;
}
