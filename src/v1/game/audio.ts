/** Synthesised foley placeholders. Final sound replaces these one for one. */
let ctx: AudioContext | null = null;
export let soundOn = true;

export function setSound(on: boolean) {
  soundOn = on;
}

/** Browsers only allow audio after a touch; call this from the first pointer event. */
export function unlock() {
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    ctx = null;
  }
}

function tone(from: number, to: number, dur: number, type: OscillatorType = 'sine', gain = 0.06, delay = 0) {
  if (!soundOn || !ctx || ctx.state !== 'running') return;
  const t = ctx.currentTime + delay, o = ctx.createOscillator(), a = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(from, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
  a.gain.setValueAtTime(0.0001, t);
  a.gain.exponentialRampToValueAtTime(gain, t + 0.015);
  a.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(a).connect(ctx.destination);
  o.start(t);
  o.stop(t + dur + 0.03);
}

export const sfx = {
  clap: () => { tone(900, 120, 0.06, 'square', 0.05); tone(700, 90, 0.08, 'square', 0.04, 0.02); },
  squeak: () => tone(880, 1500, 0.12, 'sine', 0.05),
  eek: () => { tone(900, 1700, 0.09, 'triangle', 0.035); tone(1400, 800, 0.12, 'triangle', 0.03, 0.08); },
  paw: () => { tone(520, 820, 0.16, 'sine', 0.05); tone(820, 600, 0.2, 'sine', 0.04, 0.14); },
  sulk: () => tone(300, 150, 0.35, 'sawtooth', 0.03),
  chalk: () => tone(1800, 1300, 0.04, 'triangle', 0.02),
  tick: () => tone(660, 660, 0.05, 'sine', 0.03),
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, f, 0.18, 'triangle', 0.05, i * 0.11)),
  /** The monster's roar gets deeper as the shadow grows. */
  roar: (m: number) => { const f = 260 / m; tone(f * 1.4, f * 0.6, 0.9, 'sawtooth', 0.07); tone(f * 0.7, f * 0.4, 1.0, 'square', 0.03); },
};
