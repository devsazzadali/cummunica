// Step 4 unit tests — NO live DB, NO browser, NO mic/cam.
// Pure logic only: codec preference, constraint objects, quality
// stepping/derivation, signal validation, call gate predicate.
// Run:
//   npx tsc tests/webrtc-unit.ts src/lib/webrtc.ts src/lib/validation.ts src/lib/errors.ts \
//     --module commonjs --target es2022 --outDir /tmp/step4-unit \
//     --skipLibCheck --esModuleInterop --moduleResolution node \
//   && node /tmp/step4-unit/tests/webrtc-unit.js
import {
  AUDIO_CONSTRAINTS, VIDEO_TIERS, deriveQualityFromStats, getAudioConstraints,
  getMediaConstraints, getVideoConstraints, preferOpusCodecs, qualityFromSample,
  stepTierIndex, userRoom, validateSignalMessage,
} from "../src/lib/webrtc";
import { callGateAllows } from "../src/lib/validation";

let passed = 0;
let failed = 0;
function ok(name: string, cond: boolean): void {
  if (cond) { passed++; console.log(`PASS ${name}`); }
  else { failed++; console.log(`FAIL ${name}`); }
}
function throws(name: string, fn: () => unknown): void {
  try { fn(); ok(name, false); } catch { ok(name, true); }
}

function main(): void {
  // Audio clarity flags are always on, never disabled.
  ok("audio echoCancellation true", AUDIO_CONSTRAINTS.echoCancellation === true);
  ok("audio noiseSuppression true", AUDIO_CONSTRAINTS.noiseSuppression === true);
  ok("audio autoGainControl true", AUDIO_CONSTRAINTS.autoGainControl === true);
  const ac = getAudioConstraints();
  ok("audio constraints carry all three flags",
    (ac.audio as Record<string, unknown>).echoCancellation === true &&
    (ac.audio as Record<string, unknown>).noiseSuppression === true &&
    (ac.audio as Record<string, unknown>).autoGainControl === true);

  // Video: ideal HD first, graceful tiers, never exact.
  ok("HD tier first 1280x720@30", VIDEO_TIERS[0].width === 1280 && VIDEO_TIERS[0].height === 720 && VIDEO_TIERS[0].frameRate === 30);
  ok("fallback tier exists 640x480", VIDEO_TIERS.some((t) => t.width === 640 && t.height === 480));
  ok("lowest tier exists below SD", VIDEO_TIERS[VIDEO_TIERS.length - 1].width < 640);
  const vc = getVideoConstraints(VIDEO_TIERS[0]) as Record<string, { ideal?: number; exact?: number }>;
  ok("video constraints use ideal not exact", vc.width.ideal === 1280 && vc.width.exact === undefined);
  const mc = getMediaConstraints("video", VIDEO_TIERS[0]);
  ok("video media keeps audio flags", (mc.audio as Record<string, unknown>).echoCancellation === true);
  ok("audio-only media has no video", getMediaConstraints("audio", VIDEO_TIERS[0]).video === undefined);

  // Opus preference: pure reorder, input untouched.
  const codecs = [{ mimeType: "audio/PCMA" }, { mimeType: "audio/opus" }, { mimeType: "video/VP8" }];
  const ordered = preferOpusCodecs(codecs);
  ok("opus moved first", ordered[0].mimeType === "audio/opus" && ordered.length === 3);
  ok("opus reorder does not mutate input", codecs[1].mimeType === "audio/opus");
  ok("no opus means unchanged order", preferOpusCodecs([{ mimeType: "audio/PCMA" }])[0].mimeType === "audio/PCMA");

  // Quality stepping: clamped at both ends.
  ok("step down 0->1", stepTierIndex(0, "down") === 1);
  ok("step down clamps at last", stepTierIndex(VIDEO_TIERS.length - 1, "down") === VIDEO_TIERS.length - 1);
  ok("step up 1->0", stepTierIndex(1, "up") === 0);
  ok("step up clamps at 0", stepTierIndex(0, "up") === 0);

  // Quality derivation: weak on high RTT / loss / failure, good otherwise.
  ok("quality good clean", qualityFromSample({ rttMs: 80, lossFraction: 0.01 }) === "good");
  ok("quality weak high rtt", qualityFromSample({ rttMs: 500, lossFraction: 0 }) === "weak");
  ok("quality weak high loss", qualityFromSample({ rttMs: 50, lossFraction: 0.2 }) === "weak");
  ok("quality weak failed state", qualityFromSample({ rttMs: null, lossFraction: null, connectionState: "failed" }) === "weak");
  ok("quality good unknown-but-connected", qualityFromSample({ rttMs: null, lossFraction: null, connectionState: "connected" }) === "good");
  const derived = deriveQualityFromStats([
    { type: "candidate-pair", nominated: true, currentRoundTripTime: 0.42 },
    { type: "outbound-rtp", packetsSent: 1000, packetsLost: 80 },
    { type: "inbound-rtp", packetsReceived: 5 },
  ]);
  ok("derive weak from stats (rtt+loss)", derived.quality === "weak" && derived.rttMs === 420 && derived.lossFraction === 0.08);
  const derivedGood = deriveQualityFromStats([
    { type: "candidate-pair", nominated: true, currentRoundTripTime: 0.05 },
    { type: "outbound-rtp", packetsSent: 1000, packetsLost: 2 },
  ]);
  ok("derive good from stats", derivedGood.quality === "good");

  // Signal validation: good shapes pass, malformed shapes throw.
  ok("signal offer valid", validateSignalMessage({ callId: "c1", kind: "offer", payload: { type: "offer", sdp: "v=0" } }).kind === "offer");
  ok("signal ice null candidate valid", validateSignalMessage({ callId: "c1", kind: "ice", payload: { candidate: null } }).kind === "ice");
  throws("signal missing callId rejected", () => validateSignalMessage({ kind: "offer", payload: { sdp: "x" } }));
  throws("signal bad kind rejected", () => validateSignalMessage({ callId: "c1", kind: "bogus", payload: {} }));
  throws("signal offer without sdp rejected", () => validateSignalMessage({ callId: "c1", kind: "offer", payload: { type: "offer" } }));
  throws("signal ice without candidate field rejected", () => validateSignalMessage({ callId: "c1", kind: "ice", payload: {} }));
  throws("signal non-object rejected", () => validateSignalMessage("hello"));
  throws("signal array rejected", () => validateSignalMessage([]));

  // Gate predicate (server-side rule, re-checked here for the client docs).
  ok("gate accepted+unblocked allowed", callGateAllows({ accepted: true, isBlocked: false }));
  ok("gate blocked denied", !callGateAllows({ accepted: true, isBlocked: true }));
  ok("gate unaccepted denied", !callGateAllows({ accepted: false, isBlocked: false }));
  ok("gate missing denied", !callGateAllows(null));

  ok("user room naming", userRoom("u1") === "user:u1");

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}
main();
