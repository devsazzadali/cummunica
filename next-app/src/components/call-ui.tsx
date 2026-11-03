// Step 4 — Real call screen (replaces the Step 2 simulated shell).
// Wired to browser WebRTC (src/lib/webrtc.ts) + our own signalling
// (/api/calls REST queue, plus live Socket.io relay when the custom
// server in server.mjs is running). Uses ONLY the existing central
// theme classes (DESIGN_HOLD: no new final colours/fonts/icons).
// Honest behaviour, never a simulated call:
// - The timer runs ONLY after the peer connection reports
//   "connected" — there is no fake ringing timer.
// - Permission denial and not-accepted-contact (403) are shown as
//   plain errors; no call is pretended.
// - No media is captured before accept: the caller captures only
//   after the callee accepts; the callee captures only after tapping
//   Accept. The incoming-screen camera preview is opt-in, local
//   only, and never attached to a peer connection.
// - Incoming calls without a callId listen (REST poll + socket push)
//   for a real invite; a socket push is re-verified against
//   GET /api/calls?callId=... before any accept UI appears.
"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Mic, MicOff, Volume2, VolumeX, Video, VideoOff, PhoneOff, Signal, PhoneIncoming } from "lucide-react";
import { Avatar } from "@/components/ui";
import {
  applyOpusPreference, acquireLocalMedia, createPeerConnection, deriveQualityFromStats,
  setVideoBitrate, stepTierIndex, validateSignalMessage, VIDEO_TIERS,
  type CallQuality, type SignalMessage,
} from "@/lib/webrtc";
import {
  callAction, fetchCallStatus, fetchIncoming, queueSignal, readToken,
  resolveCalleeIdentifier, startCall,
} from "@/lib/call-api";
import type { Socket } from "socket.io-client";

type Phase = "starting" | "listening" | "ringing" | "incoming" | "connecting" | "connected" | "ended" | "error";

const OUTCOME_TEXT: Record<string, string> = {
  DECLINED: "The call was declined.",
  CANCELLED: "The call was cancelled.",
  MISSED: "No answer — the call was missed after 30 seconds.",
  ENDED: "The call ended.",
  gone: "This call is no longer active.",
  busy: "They are already on another call.",
};

function fmtElapsed(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function CallScreen({ name, kind, variant, callee, callId: initialCallId }: {
  name: string; kind: "audio" | "video"; variant: "incoming" | "outgoing";
  callee?: string; callId?: string;
}) {
  const [phase, setPhase] = useState<Phase>("starting");
  const [error, setError] = useState("");
  const [endedReason, setEndedReason] = useState("");
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(true);
  const [videoOn, setVideoOn] = useState(kind === "video");
  const [quality, setQuality] = useState<CallQuality>("good");
  const [qualityDetail, setQualityDetail] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [previewOn, setPreviewOn] = useState(false);
  const [callId, setCallId] = useState<string | null>(initialCallId ?? null);

  const phaseRef = useRef<Phase>("starting");
  const callIdRef = useRef<string | null>(initialCallId ?? null);
  const roleRef = useRef<"caller" | "callee">(variant === "incoming" ? "callee" : "caller");
  const tokenRef = useRef<string | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localRef = useRef<MediaStream | null>(null);
  const previewRef = useRef<MediaStream | null>(null);
  const remoteRef = useRef<MediaStream | null>(null);
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);
  const acceptedRef = useRef(false);
  const endedRef = useRef(false);
  const tierIndexRef = useRef(0);
  const goodStreakRef = useRef(0);
  const connectedAtRef = useRef<number | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const calleeIdRef = useRef<string>("");
  const socketLiveRef = useRef(false);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  const go = (p: Phase) => { phaseRef.current = p; setPhase(p); };
  const [authError, setAuthError] = useState(false);
  const fail = (msg: string, isAuth = false) => { setAuthError(isAuth); setError(msg); go("error"); };
  const finish = (reason: string) => {
    if (endedRef.current) return;
    endedRef.current = true;
    setEndedReason(reason);
    teardown();
    go("ended");
  };

  function stopStream(s: MediaStream | null): void {
    s?.getTracks().forEach((t) => { try { t.stop(); } catch { /* already stopped */ } });
  }
  function teardown(): void {
    try { pcRef.current?.close(); } catch { /* already closed */ }
    pcRef.current = null;
    stopStream(localRef.current); localRef.current = null;
    stopStream(previewRef.current); previewRef.current = null;
    try { socketRef.current?.disconnect(); } catch { /* already disconnected */ }
    socketRef.current = null; socketLiveRef.current = false;
  }

  function attachLocal(stream: MediaStream): void {
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;
  }
  function attachRemote(stream: MediaStream): void {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = stream;
      remoteVideoRef.current.muted = !speaker;
    }
  }

  async function sendSignal(kindSig: SignalMessage["kind"], payload: Record<string, unknown>): Promise<boolean> {
    const id = callIdRef.current;
    const token = tokenRef.current;
    if (!id || !token) return false;
    try {
      if (socketLiveRef.current && socketRef.current?.connected) {
        socketRef.current.emit("call:signal", { callId: id, kind: kindSig, payload });
        return true;
      }
      await queueSignal(token, id, kindSig, payload);
      return true;
    } catch {
      return false;
    }
  }

  function flushPendingIce(): void {
    const pc = pcRef.current;
    if (!pc || !pc.remoteDescription) return;
    const queued = pendingIceRef.current;
    pendingIceRef.current = [];
    queued.forEach((c) => {
      pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => undefined);
    });
  }

  async function handleSignal(raw: unknown): Promise<void> {
    let msg: SignalMessage;
    try { msg = validateSignalMessage(raw); } catch { return; } // Drop malformed signals.
    if (msg.callId !== callIdRef.current) return;
    const pc = pcRef.current;
    if (!pc) return; // No peer connection yet (e.g. still ringing) — poll redelivers later.
    try {
      if (msg.kind === "offer") {
        if (pc.remoteDescription) return; // Duplicate offer guard.
        await pc.setRemoteDescription(new RTCSessionDescription(msg.payload as unknown as RTCSessionDescriptionInit));
        flushPendingIce();
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        if (!(await sendSignal("answer", answer as unknown as Record<string, unknown>))) fail("Signalling failed while answering the call.");
      } else if (msg.kind === "answer") {
        if (pc.signalingState !== "have-local-offer") return; // Duplicate/stale answer guard.
        await pc.setRemoteDescription(new RTCSessionDescription(msg.payload as unknown as RTCSessionDescriptionInit));
        flushPendingIce();
      } else if (msg.kind === "ice") {
        const cand = msg.payload as RTCIceCandidateInit;
        if (pc.remoteDescription) {
          await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => undefined);
        } else {
          pendingIceRef.current.push(cand);
        }
      }
    } catch {
      // A single bad signal must not kill the call UI; later signals
      // (or a retry) may still complete negotiation.
    }
  }

  function createPC(): RTCPeerConnection {
    const pc = createPeerConnection();
    pc.onicecandidate = (e) => {
      if (e.candidate) void sendSignal("ice", e.candidate.toJSON() as unknown as Record<string, unknown>);
    };
    pc.ontrack = (e) => {
      if (!remoteRef.current) remoteRef.current = new MediaStream();
      e.streams[0]?.getTracks().forEach((t) => remoteRef.current?.addTrack(t));
      if (remoteRef.current) attachRemote(remoteRef.current);
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected" && connectedAtRef.current === null) {
        connectedAtRef.current = Date.now();
        go("connected");
      } else if (pc.connectionState === "failed") {
        fail("Connection failed — the network could not connect this call. Check your connection and try again.");
      }
    };
    pcRef.current = pc;
    return pc;
  }

  async function beginMediaAndOffer(): Promise<void> {
    const token = tokenRef.current;
    if (!token || endedRef.current) return;
    go("connecting");
    try {
      const { stream } = await acquireLocalMedia(kind === "video" ? "video" : "audio");
      if (endedRef.current) { stopStream(stream); return; }
      localRef.current = stream;
      attachLocal(stream);
      const pc = createPC();
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      applyOpusPreference(pc);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      if (!(await sendSignal("offer", offer as unknown as Record<string, unknown>))) fail("Signalling failed while starting the call.");
    } catch (err) {
      fail(err instanceof Error ? err.message : "Could not start the microphone/camera.");
    }
  }

  async function acceptIncoming(): Promise<void> {
    const token = tokenRef.current;
    const id = callIdRef.current;
    if (!token || !id) return;
    try {
      await callAction(token, "accept", id);
    } catch (err) {
      fail(err instanceof Error ? err.message : "Could not accept the call.");
      return;
    }
    acceptedRef.current = true;
    stopStream(previewRef.current); previewRef.current = null; setPreviewOn(false);
    go("connecting");
    try {
      const { stream } = await acquireLocalMedia(kind === "video" ? "video" : "audio");
      if (endedRef.current) { stopStream(stream); return; }
      localRef.current = stream;
      attachLocal(stream);
      const pc = createPC();
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      applyOpusPreference(pc);
      // The caller's offer arrives via poll/socket from here on.
    } catch (err) {
      fail(err instanceof Error ? err.message : "Could not start the microphone/camera.");
    }
  }

  async function declineIncoming(): Promise<void> {
    const token = tokenRef.current;
    const id = callIdRef.current;
    if (token && id) {
      try { await callAction(token, "decline", id); } catch { /* already gone */ }
    }
    finish("You declined the call.");
  }

  async function endCall(): Promise<void> {
    const token = tokenRef.current;
    const id = callIdRef.current;
    if (token && id && !endedRef.current) {
      try {
        if (acceptedRef.current || roleRef.current === "callee") {
          await callAction(token, acceptedRef.current ? "end" : "decline", id);
        } else {
          await callAction(token, "cancel", id);
        }
      } catch { /* server already swept it; local teardown still runs */ }
    }
    finish("Call ended.");
  }

  async function togglePreview(): Promise<void> {
    if (previewOn) {
      stopStream(previewRef.current); previewRef.current = null; setPreviewOn(false);
      return;
    }
    try {
      const { stream } = await acquireLocalMedia(kind === "video" ? "video" : "audio");
      previewRef.current = stream;
      attachLocal(stream);
      setPreviewOn(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the camera preview.");
    }
  }

  function toggleMute(): void {
    const track = localRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMuted(!track.enabled);
  }
  function toggleVideo(): void {
    const track = localRef.current?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setVideoOn(track.enabled);
  }
  function toggleSpeaker(): void {
    const next = !speaker;
    setSpeaker(next);
    if (remoteVideoRef.current) remoteVideoRef.current.muted = !next;
  }

  // Socket: best-effort live relay. If the custom server is not
  // running, connection fails quietly and REST polling carries the
  // call — the user is never blocked on the socket.
  function connectSocket(token: string): void {
    import("socket.io-client").then(({ io }) => {
      if (endedRef.current) return;
      const socket = io(undefined, { auth: { token }, reconnectionAttempts: 3, timeout: 4000 });
      socketRef.current = socket;
      socket.on("connect", () => {
        socketLiveRef.current = true;
        const id = callIdRef.current;
        if (id && roleRef.current === "caller" && calleeIdRef.current !== "") {
          socket.emit("call:register", { callId: id, calleeId: calleeIdRef.current });
        }
      });
      socket.on("disconnect", () => { socketLiveRef.current = false; });
      socket.on("call:signal", (msg: unknown) => { void handleSignal(msg); });
      socket.on("call:incoming", async (msg: { callId?: string }) => {
        if (phaseRef.current !== "listening" || typeof msg.callId !== "string") return;
        try {
          const st = await fetchCallStatus(token, msg.callId);
          if (st.status === "ringing") {
            callIdRef.current = msg.callId; setCallId(msg.callId); go("incoming");
          }
        } catch { /* forged/expired push: ignore, poll stays authoritative */ }
      });
    }).catch(() => undefined);
  }

  // One-time start: resolve + invite (outgoing), verify + wait
  // (incoming with callId), or listen (incoming without callId).
  useEffect(() => {
    const token = readToken();
    tokenRef.current = token;
    if (!token) {
      setAuthError(true); setError("Sign in to place or receive a real call. Calls only go to contacts who have accepted you.");
      go("error");
      return;
    }
    // Own-system signalling only: REST polling (/api/calls) + WebRTC browser-to-browser.
    // No Socket.io, no external calling app, no third-party API is used in the call flow.
    let cancelled = false;
    (async () => {
      if (variant === "incoming" && initialCallId) {
        try {
          const st = await fetchCallStatus(token, initialCallId);
          if (cancelled) return;
          if (st.status === "ringing") { callIdRef.current = initialCallId; setCallId(initialCallId); go("incoming"); }
          else finish(OUTCOME_TEXT[st.status] ?? "This call is no longer active.");
        } catch {
          if (!cancelled) fail("Could not load this incoming call. It may already have ended.");
        }
        return;
      }
      if (variant === "incoming") { go("listening"); return; }
      // Outgoing: resolve the dialled name/ID to a real user, then invite.
      const query = callee ?? name;
      let meUser = ""; let meId = "";
      try { const u = JSON.parse(localStorage.getItem("communica_user") ?? "{}"); meUser = (u.username ?? "").toLowerCase(); meId = u.communicaId ?? ""; } catch {}
      if (query.trim().toLowerCase().replace(/^@/, "") === meUser || (meId && query.trim() === meId)) {
        fail("This is your own account — you cannot call yourself. Call another registered user who has accepted you as a contact.");
        return;
      }
      let identifier: string | null = null;
      try { identifier = await resolveCalleeIdentifier(token, query); }
      catch (err) {
        if ((err as { status?: number }).status === 401) { fail("Your sign-in expired. Sign in again and retry the call.", true); return; }
        fail("Could not check that user right now — please try again."); return;
      }
      if (cancelled) return;
      if (!identifier) {
        fail(`Could not find "${query}" as a registered Communica user. That account has not registered on this app yet, or the name/ID is wrong — ask them to register first, then send a contact request and wait for acceptance before calling.`);
        return;
      }
      try {
        const started = await startCall(token, identifier, kind === "video" ? "VIDEO" : "AUDIO");
        if (cancelled) return;
        if (started.status === "busy") { finish(OUTCOME_TEXT.busy); return; }
        if (!started.callId) { fail("The call could not be started. Try again."); return; }
        callIdRef.current = started.callId; setCallId(started.callId);
        if (started.calleeId) calleeIdRef.current = started.calleeId;
        if (socketRef.current?.connected && started.calleeId) {
          socketRef.current.emit("call:register", { callId: started.callId, calleeId: started.calleeId });
          socketRef.current.emit("call:notify", { callId: started.callId, calleeId: started.calleeId, type: kind === "video" ? "VIDEO" : "AUDIO" });
        }
        go("ringing");
      } catch (err) {
        const status = (err as { status?: number }).status;
        if (status === 403) {
          fail("This contact has not accepted you yet, or has blocked calls. Calls are only allowed to accepted contacts.");
        } else if (status === 401) {
          fail("Your sign-in expired. Sign in again and retry the call.", true);
        } else {
          fail(err instanceof Error ? err.message : "The call could not be started.");
        }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll loop once a callId exists: status transitions + queued signals.
  useEffect(() => {
    if (!callId || !tokenRef.current) return;
    const token = tokenRef.current;
    const timer = setInterval(() => {
      if (endedRef.current) return;
      void fetchCallStatus(token, callId).then((st) => {
        if (endedRef.current) return;
        if (st.status === "accepted" && roleRef.current === "caller" && !acceptedRef.current) {
          acceptedRef.current = true;
          void beginMediaAndOffer();
        } else if (st.status === "DECLINED" || st.status === "CANCELLED" || st.status === "MISSED" || st.status === "ENDED" || st.status === "gone") {
          finish(OUTCOME_TEXT[st.status] ?? "This call is no longer active.");
          return;
        }
        st.signals.forEach((s) => { void handleSignal(s); });
      }).catch(() => undefined);
    }, 2000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callId]);

  // Incoming listening poll (no callId yet): real invites only.
  useEffect(() => {
    if (phase !== "listening" || !tokenRef.current) return;
    const token = tokenRef.current;
    const timer = setInterval(() => {
      if (endedRef.current || phaseRef.current !== "listening") return;
      void fetchIncoming(token).then((list) => {
        if (list.length > 0 && phaseRef.current === "listening") {
          callIdRef.current = list[0].callId; setCallId(list[0].callId); go("incoming");
        }
      }).catch(() => undefined);
    }, 3000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Call timer: runs ONLY after the connection reports "connected".
  useEffect(() => {
    if (phase !== "connected") return;
    const timer = setInterval(() => {
      if (connectedAtRef.current !== null) setElapsed(Math.floor((Date.now() - connectedAtRef.current) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [phase]);

  // Adaptive quality: getStats every 3s while connected. Video steps
  // down first; audio is never capped. Steps back up only after two
  // consecutive good samples, so quality does not flap.
  useEffect(() => {
    if (phase !== "connected") return;
    const pc = pcRef.current;
    if (!pc) return;
    const timer = setInterval(() => {
      const live = pcRef.current;
      if (!live || endedRef.current) return;
      void live.getStats().then((report) => {
        const entries: Array<Record<string, unknown>> = [];
        report.forEach((r) => {
          entries.push({
            type: r.type,
            nominated: (r as Record<string, unknown>).nominated,
            currentRoundTripTime: (r as Record<string, unknown>).currentRoundTripTime,
            packetsSent: (r as Record<string, unknown>).packetsSent,
            packetsLost: (r as Record<string, unknown>).packetsLost,
          });
        });
        const { quality, rttMs, lossFraction } = deriveQualityFromStats(entries);
        setQuality(quality);
        setQualityDetail(
          quality === "weak"
            ? `Weak connection — likely your network (round-trip ${rttMs ?? "?"} ms${lossFraction !== null ? `, packet loss ${Math.round(lossFraction * 100)}%` : ""}). Video is reduced to protect audio.`
            : "Good connection.",
        );
        const videoSender = live.getSenders().find((s) => s.track?.kind === "video");
        if (!videoSender) return;
        if (quality === "weak") {
          goodStreakRef.current = 0;
          const next = stepTierIndex(tierIndexRef.current, "down");
          if (next !== tierIndexRef.current) {
            tierIndexRef.current = next;
            const tier = VIDEO_TIERS[next];
            setVideoBitrate(videoSender, tier.maxBitrateBps);
            const track = videoSender.track;
            if (track) {
              track.applyConstraints({
                width: { ideal: tier.width }, height: { ideal: tier.height }, frameRate: { ideal: tier.frameRate },
              }).catch(() => undefined);
            }
          }
        } else {
          goodStreakRef.current += 1;
          if (goodStreakRef.current >= 2 && tierIndexRef.current > 0) {
            goodStreakRef.current = 0;
            tierIndexRef.current = stepTierIndex(tierIndexRef.current, "up");
            const tier = VIDEO_TIERS[tierIndexRef.current];
            setVideoBitrate(videoSender, tier.maxBitrateBps);
          }
        }
      }).catch(() => undefined);
    }, 3000);
    return () => clearInterval(timer);
  }, [phase]);

  // Unmount: stop media + close the connection. A live call is ended
  // best-effort so the peer is not left ringing forever.
  useEffect(() => {
    return () => {
      if (!endedRef.current && callIdRef.current && tokenRef.current) {
        const token = tokenRef.current;
        const id = callIdRef.current;
        const action = acceptedRef.current ? "end" : roleRef.current === "caller" ? "cancel" : "decline";
        void callAction(token, action, id).catch(() => undefined);
      }
      teardown();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (remoteVideoRef.current) remoteVideoRef.current.muted = !speaker;
  }, [speaker]);

  if (phase === "error") {
    return (
      <div className="call-shell">
        <Avatar name={name} size={160} />
        <h2>{name}</h2>
        <p role="alert">{error}</p>
        <p className="call-timer">No call was placed. No microphone or camera was used for a fake call.</p>
        <Link className="btn btn-green" href="/calls">Back to Calls</Link>
        {authError ? <Link className="btn btn-light" href="/login">Sign in</Link> : null}
        {/Could not find|own account/.test(error) ? <Link className="btn btn-light" href="/new-chat">Find a user</Link> : null}
      </div>
    );
  }
  if (phase === "ended") {
    return (
      <div className="call-shell">
        <Avatar name={name} size={160} />
        <h2>{name}</h2>
        <p className="empty">{endedReason || "Call ended."}</p>
        <Link className="btn btn-green" href="/calls">Back to Calls</Link>
      </div>
    );
  }
  if (phase === "listening") {
    return (
      <div className="call-shell">
        <PhoneIncoming size={48} />
        <h2>Waiting for an incoming call</h2>
        <p>Listening for a real invite from an accepted contact. Nothing is simulated here — when someone calls you, Accept / Decline will appear.</p>
        <p className="call-timer">Calls are in-app only. The dialled ID is an in-app Communica ID, never a phone number.</p>
        <Link className="btn btn-light" href="/calls">Back to Calls</Link>
      </div>
    );
  }

  const statusText =
    phase === "starting" ? "Starting…" :
    phase === "ringing" ? `Ringing… waiting for ${name} to accept (30 seconds)` :
    phase === "incoming" ? `Incoming ${kind} call` :
    phase === "connecting" ? "Connecting…" :
    `In call — ${kind} (in-app only)`;

  return (
    <div className="call-shell">
      <Avatar name={name} size={160} />
      <h2>{name}</h2>
      <p>{statusText}</p>
      {phase === "connected" ? <p className="call-timer">{fmtElapsed(elapsed)}</p> : <p className="call-timer">Timer starts only when the call actually connects.</p>}
      {phase === "connected" ? (
        <p className="quality"><Signal size={16} /> Call quality: {quality === "good" ? "Good" : "Weak"} — {qualityDetail}</p>
      ) : null}
      {kind === "video" ? (
        <div className="video-placeholder">
          <video ref={remoteVideoRef} autoPlay playsInline style={{ width: "100%", maxWidth: 560 }} aria-label="Remote video" />
          <video ref={localVideoRef} autoPlay playsInline muted style={{ width: "100%", maxWidth: 280, marginTop: 8 }} aria-label="Local video preview" />
          {phase !== "connected" && phase !== "connecting" ? <p>Video appears here once the call connects. No camera is started before accept.</p> : null}
        </div>
      ) : (
        <video ref={remoteVideoRef} autoPlay playsInline style={{ display: "none" }} aria-label="Remote audio" />
      )}
      {phase === "incoming" ? (
        <div className="call-answer-row">
          <button type="button" className="btn btn-green" onClick={() => void acceptIncoming()}>Accept call</button>
          <button type="button" className="btn btn-danger" onClick={() => void declineIncoming()}>Decline call</button>
          {kind === "video" ? <button type="button" className="btn btn-light" onClick={() => void togglePreview()}>{previewOn ? "Stop camera preview" : "Enable camera preview"}</button> : null}
        </div>
      ) : null}
      {phase === "incoming" ? (
        <p className="call-timer">No microphone or camera is captured until you tap Accept. The preview above is local only and is never sent to the other person.</p>
      ) : null}
      {phase === "connected" || phase === "connecting" || phase === "ringing" ? (
        <div className="call-controls">
          <button type="button" className={muted ? "call-btn call-btn-on" : "call-btn"} aria-label={muted ? "Unmute" : "Mute"} onClick={toggleMute} disabled={phase !== "connected"}>{muted ? <MicOff size={22} /> : <Mic size={22} />}<span>{muted ? "Muted" : "Mute"}</span></button>
          <button type="button" className={speaker ? "call-btn call-btn-on" : "call-btn"} aria-label="Speaker" onClick={toggleSpeaker} disabled={phase !== "connected"}>{speaker ? <Volume2 size={22} /> : <VolumeX size={22} />}<span>Speaker</span></button>
          <button type="button" className={videoOn ? "call-btn call-btn-on" : "call-btn"} aria-label="Video on/off" onClick={toggleVideo} disabled={phase !== "connected" || kind !== "video"}>{videoOn ? <Video size={22} /> : <VideoOff size={22} />}<span>Video</span></button>
          <button type="button" className="call-btn call-btn-end" aria-label="End call" onClick={() => void endCall()}><PhoneOff size={22} /><span>End</span></button>
        </div>
      ) : null}
      {phase === "ringing" ? (
        <div className="call-answer-row">
          <button type="button" className="btn btn-danger" onClick={() => void endCall()}>Cancel call</button>
        </div>
      ) : null}
      <p className="call-timer">In-app call only. Audio: Opus with echo cancellation, noise suppression and auto gain. Video: HD 1280×720@30fps ideal with graceful fallback; on a weak network video is reduced first to protect audio. Network, device, camera and mic set the ceiling — perfect quality on a bad network is not promised.</p>
    </div>
  );
}
