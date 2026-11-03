// Own-system message sounds: WebAudio tones generated in the browser.
// No external sound file, no external service, no third-party app.
export function soundOn(): boolean {
  try { return localStorage.getItem("communica_sound") !== "off"; } catch { return true; }
}
export function setSoundOn(on: boolean) {
  try { localStorage.setItem("communica_sound", on ? "on" : "off"); } catch {}
}
function tone(freq: number, dur: number, delay: number, vol: number) {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine"; osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(vol, ctx.currentTime + delay + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + dur);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(ctx.currentTime + delay); osc.stop(ctx.currentTime + delay + dur + 0.05);
    osc.onended = () => { void ctx.close().catch(() => {}); };
  } catch {}
}
export function playSendSound() { if (soundOn()) tone(880, 0.12, 0, 0.08); }
export function playReceiveSound() { if (soundOn()) { tone(660, 0.15, 0, 0.08); tone(990, 0.2, 0.12, 0.08); } }
export async function notifyMessage(title: string, body: string) {
  try {
    if (typeof document !== "undefined" && !document.hidden) return;
    if (!("Notification" in window)) return;
    if (Notification.permission === "granted") {
      const n = new Notification(title, { body, tag: "communica-message" });
      n.onclick = () => { window.focus(); n.close(); };
    }
  } catch {}
}

// Incoming-call ringtone: own WebAudio tones, no external file.
// Returns a stop function. Repeats until stopped (accept/decline/end).
export function startRingtone(): () => void {
  if (!soundOn()) return () => {};
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return () => {};
    const ctx = new Ctx();
    void ctx.resume().catch(() => {});
    const beep = (freq: number, at: number, dur: number) => {
      try {
        const osc = ctx.createOscillator(); const gain = ctx.createGain();
        osc.type = "sine"; osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, ctx.currentTime + at);
        gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + at + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + dur);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(ctx.currentTime + at); osc.stop(ctx.currentTime + at + dur + 0.05);
      } catch {}
    };
    const ring = () => { beep(880, 0, 0.35); beep(880, 0.45, 0.35); };
    ring();
    const t = window.setInterval(ring, 1400);
    return () => { try { window.clearInterval(t); void ctx.close().catch(() => {}); } catch {} };
  } catch { return () => {}; }
}
export function vibrateIncoming(): void {
  try { if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate([400, 200, 400, 200, 400]); } catch {}
}
