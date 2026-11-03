// Step 4 — Own WebRTC calling logic (browser WebRTC only).
// NO third-party calling service: no Twilio, Agora, Stream, Daily,
// or any other calling SDK, dependency, or API key. Media is
// peer-to-peer once signalling completes; our own server only relays
// signalling (Socket.io custom server, or the /api/calls REST signal
// queue as fallback) and never sees media.
//
// STANDING CALL-QUALITY REQUIREMENTS (CALL_QUALITY_REQUIREMENTS.md):
// - Audio: Opus preferred; echoCancellation, noiseSuppression and
//   autoGainControl MUST be true, never disabled.
// - Video: IDEAL (never exact) 1280x720 @ 30fps, with graceful
//   fallback to 640x480 / lower fps — never fixed-HD-only, never
//   fixed-low-only.
// - Adaptive: getStats() + connectionstate drive video step-down/up;
//   video is reduced FIRST on weak bandwidth, audio is protected.
// - Honest ceiling: network, device, camera and mic set the ceiling.
//   Perfect quality on a bad network is NOT promised.
//
// SAFETY / GATES:
// - The accepted-contact gate is enforced SERVER-side (/api/calls
//   start, and the socket server's register step). This client file
//   never decides who may be called.
// - No media is sent before accept: the caller acquires media and
//   creates an offer ONLY after the callee accepts (polled via
//   GET /api/calls?callId=... or a call:accepted socket event), and
//   the callee acquires media ONLY after the user taps Accept.
//   The single exception is an explicit camera preview the user
//   turns on themselves on the incoming screen — preview tracks are
//   local only, never added to a peer connection, and are stopped
//   when the preview is closed or the call ends.
// - Caller/callee identifiers are in-app Communica IDs / usernames,
//   never real phone numbers; nothing here dials a phone network.
// - STUN is public STUN only (default below). NO TURN server is
//   provisioned now: strict NATs may fail to connect, and a
//   self-hostable TURN server is a documented later step, not a
//   silent fallback to a third-party service.

export type CallKind = "audio" | "video";
export type CallQuality = "good" | "weak";
export type SignalKind = "offer" | "answer" | "ice";

export interface SignalMessage {
  callId: string;
  kind: SignalKind;
  /** SDP (offer/answer) or ICE candidate payload, as JSON. */
  payload: Record<string, unknown>;
}

/** Public STUN only. No TURN provisioned (see header). */
export const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
];

/** Audio constraints — the three clarity flags are always true. */
export const AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
};

/** Video tiers, highest first. Constraints use ideal, never exact,
 *  so the browser may step down on its own when hardware cannot
 *  meet the request. */
export interface VideoTier {
  label: "hd" | "sd" | "low";
  width: number;
  height: number;
  frameRate: number;
  /** Max video send bitrate (bps) for this tier, 0 = no cap. */
  maxBitrateBps: number;
}
export const VIDEO_TIERS: VideoTier[] = [
  { label: "hd", width: 1280, height: 720, frameRate: 30, maxBitrateBps: 2500000 },
  { label: "sd", width: 640, height: 480, frameRate: 24, maxBitrateBps: 900000 },
  { label: "low", width: 426, height: 240, frameRate: 15, maxBitrateBps: 300000 },
];

export function getAudioConstraints(): MediaStreamConstraints {
  return { audio: { ...AUDIO_CONSTRAINTS } };
}

export function getVideoConstraints(tier: VideoTier): MediaTrackConstraints {
  return {
    width: { ideal: tier.width },
    height: { ideal: tier.height },
    frameRate: { ideal: tier.frameRate },
  };
}

export function getMediaConstraints(kind: CallKind, tier: VideoTier): MediaStreamConstraints {
  if (kind === "audio") return getAudioConstraints();
  return { audio: { ...AUDIO_CONSTRAINTS }, video: getVideoConstraints(tier) };
}

/** Pure: move any Opus audio codec to the front, keep order otherwise.
 *  Takes plain { mimeType } objects so it is unit-testable without a
 *  browser. Returns a new array; the input is never mutated. */
export function preferOpusCodecs<T extends { mimeType: string }>(codecs: T[]): T[] {
  const opus = codecs.filter((c) => c.mimeType.toLowerCase() === "audio/opus");
  const rest = codecs.filter((c) => c.mimeType.toLowerCase() !== "audio/opus");
  return [...opus, ...rest];
}

/** Apply Opus preference to a live peer connection where the browser
 *  allows it (setCodecPreferences). Failure is non-fatal: the browser
 *  still negotiates Opus if both sides support it. */
export function applyOpusPreference(pc: RTCPeerConnection): void {
  try {
    pc.getTransceivers()
      .filter((t) => t.receiver.track.kind === "audio" || t.sender.track?.kind === "audio")
      .forEach((t) => {
        if (typeof t.setCodecPreferences !== "function") return;
        const caps = RTCRtpSender.getCapabilities("audio");
        if (!caps) return;
        t.setCodecPreferences(preferOpusCodecs(caps.codecs));
      });
  } catch {
    // Non-fatal: negotiation continues with browser defaults.
  }
}

export function createPeerConnection(): RTCPeerConnection {
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  return pc;
}

/** Errors surfaced honestly to the call UI (never a fake call). */
export class MediaPermissionError extends Error {
  constructor(message = "Microphone/camera permission was denied. Allow access in the browser and try again.") {
    super(message);
    this.name = "MediaPermissionError";
  }
}
export class MediaUnavailableError extends Error {
  constructor(message = "No microphone or camera is available on this device.") {
    super(message);
    this.name = "MediaUnavailableError";
  }
}

function isPermissionError(err: unknown): boolean {
  const name = (err as { name?: string }).name ?? "";
  return name === "NotAllowedError" || name === "SecurityError";
}
function isDeviceError(err: unknown): boolean {
  const name = (err as { name?: string }).name ?? "";
  return name === "NotFoundError" || name === "NotReadableError" || name === "OverconstrainedError" || name === "AbortError";
}

/**
 * Acquire local media. For video calls, try HD first, then each lower
 * tier on constraint failure — never fixed-HD-only, never fixed-low.
 * Permission denial is NOT retried across tiers: it is reported
 * immediately and honestly. Returns the tier actually granted.
 */
export async function acquireLocalMedia(
  kind: CallKind,
  getUserMedia: (c: MediaStreamConstraints) => Promise<MediaStream> = (c) =>
    navigator.mediaDevices.getUserMedia(c),
): Promise<{ stream: MediaStream; tier: VideoTier | null }> {
  if (kind === "audio") {
    try {
      const stream = await getUserMedia(getAudioConstraints());
      return { stream, tier: null };
    } catch (err) {
      if (isPermissionError(err)) throw new MediaPermissionError();
      if (isDeviceError(err)) throw new MediaUnavailableError();
      throw err;
    }
  }
  let lastErr: unknown = null;
  for (const tier of VIDEO_TIERS) {
    try {
      const stream = await getUserMedia(getMediaConstraints("video", tier));
      return { stream, tier };
    } catch (err) {
      if (isPermissionError(err)) throw new MediaPermissionError();
      lastErr = err;
      // Fall through to the next lower tier on constraint/device errors.
    }
  }
  if (isDeviceError(lastErr)) throw new MediaUnavailableError();
  throw lastErr;
}

/** Cap a video sender's bitrate (adaptive quality). Audio senders are
 *  never capped here — audio is protected, video steps down first. */
export function setVideoBitrate(sender: RTCRtpSender, maxBitrateBps: number): void {
  try {
    const params = sender.getParameters();
    if (!params.encodings || params.encodings.length === 0) params.encodings = [{}];
    params.encodings[0].maxBitrate = maxBitrateBps;
    void sender.setParameters(params).catch(() => undefined);
  } catch {
    // Non-fatal: the browser keeps its current bitrate.
  }
}

/** Pure quality-stepping: index into VIDEO_TIERS, clamped. */
export function stepTierIndex(current: number, direction: "down" | "up"): number {
  if (direction === "down") return Math.min(current + 1, VIDEO_TIERS.length - 1);
  return Math.max(current - 1, 0);
}

/** Minimal getStats-derived inputs, kept plain for unit tests. */
export interface QualitySample {
  /** Round-trip time in ms, null when unknown. */
  rttMs: number | null;
  /** Fraction of sent packets lost (0..1), null when unknown. */
  lossFraction: number | null;
  /** ICE / peer connection state, when known. */
  connectionState?: string;
  iceState?: string;
}

/** Pure: weak when RTT is high, loss is material, or the connection
 *  is not (yet) connected. Unknown-but-connected stats stay "good"
 *  rather than alarming the user without evidence. */
export function qualityFromSample(sample: QualitySample): CallQuality {
  if (sample.connectionState === "failed" || sample.connectionState === "disconnected") return "weak";
  if (sample.iceState === "failed" || sample.iceState === "disconnected") return "weak";
  if (sample.rttMs !== null && sample.rttMs > 300) return "weak";
  if (sample.lossFraction !== null && sample.lossFraction > 0.05) return "weak";
  return "good";
}

/** Pure: extract rtt/loss from simplified getStats entries (type,
 *  packetsSent, packetsLost, currentRoundTripTime). Entries that are
 *  not outbound-rtp / candidate-pair are ignored. */
export function deriveQualityFromStats(
  entries: Array<Record<string, unknown>>,
): { quality: CallQuality; rttMs: number | null; lossFraction: number | null } {
  let rttMs: number | null = null;
  let sent = 0;
  let lost = 0;
  let haveRtp = false;
  for (const e of entries) {
    if (e.type === "candidate-pair" && e.nominated === true && typeof e.currentRoundTripTime === "number") {
      rttMs = Math.round((e.currentRoundTripTime as number) * 1000);
    }
    if (e.type === "outbound-rtp" && typeof e.packetsSent === "number") {
      haveRtp = true;
      sent += e.packetsSent as number;
      if (typeof e.packetsLost === "number") lost += e.packetsLost as number;
    }
  }
  const lossFraction = haveRtp && sent > 0 ? lost / sent : null;
  return { quality: qualityFromSample({ rttMs, lossFraction }), rttMs, lossFraction };
}

/** Validate an incoming signalling message (socket or REST queue).
 *  Throws on any malformed shape; the caller must drop it, never
 *  feed it to a peer connection. Offer/answer payloads need an SDP
 *  string; ICE payloads need a candidate field (null = end-of-candidates). */
export function validateSignalMessage(value: unknown): SignalMessage {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("signal message must be an object");
  }
  const v = value as Record<string, unknown>;
  if (typeof v.callId !== "string" || v.callId === "") throw new Error("signal callId is required");
  if (v.kind !== "offer" && v.kind !== "answer" && v.kind !== "ice") {
    throw new Error("signal kind is invalid");
  }
  if (typeof v.payload !== "object" || v.payload === null || Array.isArray(v.payload)) {
    throw new Error("signal payload must be an object");
  }
  const payload = v.payload as Record<string, unknown>;
  if ((v.kind === "offer" || v.kind === "answer") && typeof payload.sdp !== "string") {
    throw new Error("signal SDP is required");
  }
  if (v.kind === "ice" && !("candidate" in payload)) {
    throw new Error("signal ICE candidate field is required");
  }
  return { callId: v.callId, kind: v.kind, payload };
}

/** Room name for a user's signalling room (socket server + client agree). */
export function userRoom(userId: string): string {
  return `user:${userId}`;
}
