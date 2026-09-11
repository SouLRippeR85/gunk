let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let sfx: GainNode | null = null;
let muted = false;

function graph(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AC({ latencyHint: "interactive" });
      master = ctx.createGain();
      sfx = ctx.createGain();
      sfx.connect(master);
      master.connect(ctx.destination);
      master.gain.value = 0.7;
    } catch {
      return null;
    }
  }
  return ctx;
}

export function unlockAudio(): void {
  try {
    const ac = graph();
    if (!ac) return;
    if (ac.state === "suspended") void ac.resume();
  } catch {}
}

export function setMuted(value: boolean): void {
  muted = value;
  if (master && ctx) master.gain.setTargetAtTime(value ? 0 : 0.7, ctx.currentTime, 0.02);
}
export function isMuted(): boolean { return muted; }

function tone(freq: number, dur: number, type: OscillatorType, gain = 0.12, slide?: number): void {
  const ac = graph();
  if (!ac || !sfx || muted) return;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, ac.currentTime);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, slide), ac.currentTime + dur);
  g.gain.setValueAtTime(gain, ac.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
  o.connect(g); g.connect(sfx); o.start(); o.stop(ac.currentTime + dur);
}
function noise(dur: number, gain = 0.08): void {
  const ac = graph();
  if (!ac || !sfx || muted) return;
  const n = Math.max(1, Math.floor(ac.sampleRate * dur));
  const buffer = ac.createBuffer(1, n, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = ac.createBufferSource();
  const g = ac.createGain();
  const filter = ac.createBiquadFilter();
  filter.type = "bandpass"; filter.frequency.value = 1400;
  src.buffer = buffer;
  g.gain.setValueAtTime(gain, ac.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
  src.connect(filter); filter.connect(g); g.connect(sfx); src.start();
}
export const sfxHit = (speed: number, smash: boolean): void => {
  const p = 0.94 + Math.random() * 0.12;
  tone(210 * p + speed * 0.18, 0.07, "square", smash ? 0.14 : 0.09);
  tone(90 * p, 0.09, "triangle", 0.06);
  if (smash) noise(0.12, 0.1);
};
export const sfxWall = (): void => { tone(70 + Math.random() * 12, 0.08, "sine", 0.07); };
export const sfxScore = (you: boolean): void => {
  if (you) { tone(420, 0.12, "square", 0.08, 620); tone(210, 0.16, "triangle", 0.05); }
  else tone(240, 0.16, "sawtooth", 0.07, 110);
};
export const sfxWin = (): void => { tone(330, 0.14, "square", 0.08); tone(415, 0.18, "square", 0.07); tone(523, 0.28, "triangle", 0.06); };
export const sfxLose = (): void => { tone(180, 0.28, "sawtooth", 0.08, 70); };
export const sfxServe = (): void => { tone(160, 0.06, "square", 0.05); };
