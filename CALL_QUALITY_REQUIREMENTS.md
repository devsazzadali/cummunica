# Communica Call Quality — STANDING REQUIREMENT

Applies to ALL call work in the Next.js build (Step 4 calling, Step 5 QA, and any later call fix). A call that connects but is blurry or echoey does NOT pass QA.

## Audio — must be clear
- Opus codec preferred for audio (set in SDP / transceiver preferences where the browser allows it).
- getUserMedia audio constraints MUST include, and must NOT disable:
  - echoCancellation: true
  - noiseSuppression: true
  - autoGainControl: true
- Prefer keeping audio clear even if video must drop in quality first.

## Video — HD where supported, graceful fallback
- Request HD where the device supports it: ideal 1280x720 at 30fps.
- Graceful fallback on weaker devices: 640x480 / lower fps — never a fixed low resolution only, and never a fixed HD that breaks weak devices.
- Use getUserMedia constraints with ideal (not exact) values so the browser can step down, plus applyConstraints / track settings handling on failure.

## Adaptive quality — do not freeze or drop
- Monitor connection quality via RTCPeerConnection.getStats() and connectionstate / iceconnectionstate.
- Step video bitrate/resolution down/up adaptively instead of freezing or dropping the call.
- If bandwidth is weak: reduce video first, protect audio; show the user the quality state (see UI below).
- Do NOT promise perfect quality on a bad network or a bad device — network, device, camera, and mic still set the ceiling. Document this honestly in the README.

## UI — user must see quality and controls
- Mute, speaker, video on/off controls on the call screen.
- Call-quality indicator: good / weak (derived from getStats / connection state, not faked).
- When quality is weak, the UI must say the network is the likely cause, not silently degrade.

## QA — call clarity tests (record in next-app/QA_REPORT.md)
QA must test, one by one, and record pass/fail:
1. Audio intelligibility — no echo/feedback in the test setup, with echoCancellation/noiseSuppression/autoGainControl enabled.
2. Video sharpness at HD (1280x720 @ 30fps where supported).
3. Video sharpness at fallback (640x480 / lower fps on a weaker profile).
4. Behaviour on a throttled/weak connection — video steps down, audio stays clear, call does not freeze or drop, quality indicator shows weak.
5. Mute, speaker, video on/off all work during a call.

No call QA item passes on "connected" alone. Blur, echo, freeze, or a silent quality drop is a FAIL, reported to the developer for fixing and re-tested until pass, with PM approval before the step closes.

## Out of scope for this requirement
- No third-party calling service (no Twilio, Agora, Stream, Daily, etc.). Calling stays in-house WebRTC + our own Socket.io signalling.
- No TURN server provisioned now. Note honestly in the README that strict NATs may need a TURN server later (self-hostable later).
