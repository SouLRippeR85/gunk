import { sfxHit, sfxScore, sfxServe, sfxWall } from "./audio";
import { POINTS_TO_WIN, type GameMode, type HudState, type Opponent } from "./types";

const STEP = 1 / 60;
const MAX_STEPS = 5;
const BALL_R = 10;
const MARGIN = 22;
const BASE_SPEED = 390;
const MAX_SPEED = 940;
const THICK = 16;

export type EngineConfig = {
  canvas: HTMLCanvasElement;
  mode: GameMode;
  cpu: Opponent;
  rallyTarget: number;
  reducedMotion: boolean;
  shake: boolean;
  portrait: boolean;
  getMuted: () => boolean;
  onHud: (hud: HudState) => void;
  onMatchEnd: (payload: { you: number; them: number; hits: number; won: boolean }) => void;
};

export type EngineHandle = {
  destroy: () => void;
  pause: () => void;
  resume: () => void;
  isPaused: () => boolean;
  setTouchAxis: (side: "p1" | "p2", value: number) => void;
};

type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; r: number; a: number };
type Floater = { x: number; y: number; text: string; life: number };
type Smear = { x: number; y: number; a: number; r: number };
type Paddle = { x: number; y: number; w: number; h: number; vx: number; vy: number; flash: number; charge: number };
type Ptr = { id: number; side: "p1" | "p2"; x: number; y: number };

function clamp(n: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, n));
}

function predictBounce(pos: number, vel: number, t: number, lo: number, hi: number): number {
  let p = pos;
  let v = vel;
  let left = t;
  for (let i = 0; i < 12 && left > 0.001; i++) {
    if (Math.abs(v) < 1) { p += v * left; break; }
    const wall = v > 0 ? hi : lo;
    const dt = (wall - p) / v;
    if (dt < 0 || dt > left) { p += v * left; break; }
    p = wall; v *= -1; left -= dt;
  }
  return p;
}

export function startEngine(cfg: EngineConfig): EngineHandle {
  const canvas = cfg.canvas;
  const surface = canvas.getContext("2d");
  if (!surface) {
    return { destroy() {}, pause() {}, resume() {}, isPaused: () => true, setTouchAxis() {} };
  }
  const ctx: CanvasRenderingContext2D = surface;
  const P = cfg.portrait;
  const rect0 = canvas.getBoundingClientRect();
  const cssW0 = Math.max(1, rect0.width);
  const cssH0 = Math.max(1, rect0.height);
  const WORLD_W = P ? 540 : 960;
  let WORLD_H = P ? 960 : 540;
  if (cssW0 > 8 && cssH0 > 8) {
    const fitted = Math.round(WORLD_W * (cssH0 / cssW0));
    WORLD_H = P ? clamp(fitted, 860, 1280) : clamp(fitted, 480, 640);
  }
  const END = P ? 116 : 40;
  const WALL = P ? Math.max(40, END - 56) : WORLD_W - 28;
  const court = P ? WORLD_H / 960 : 1;
  const BASE = BASE_SPEED * court;
  const MAX = MAX_SPEED * court;
  const playerLen = P ? 132 : 92;
  const cpuLen = P ? Math.max(84, cfg.cpu.paddleH) : cfg.cpu.paddleH;
  const keys = new Set<string>();
  const touchAxis = { p1: 0, p2: 0 };
  const ptrs = new Map<number, Ptr>();
  let raf = 0;
  let alive = true;
  let paused = false;
  let acc = 0;
  let last = performance.now();
  let time = 0;
  let hitstop = 0;
  let trauma = 0;
  let smashGlow = 0;
  let ended = false;
  let serveTimer = 0.85;
  let serveDir = -1;
  let hudTick = 0;
  let message = "SERVE";
  let you = 0;
  let them = 0;
  let hits = 0;
  let view = { scale: 1, ox: 0, oy: 0, cssW: 1, cssH: 1 };
  const player: Paddle = P
    ? { x: (WORLD_W - playerLen) / 2, y: WORLD_H - END - THICK, w: playerLen, h: THICK, vx: 0, vy: 0, flash: 0, charge: 0 }
    : { x: END, y: (WORLD_H - playerLen) / 2, w: THICK, h: playerLen, vx: 0, vy: 0, flash: 0, charge: 0 };
  const cpu: Paddle = P
    ? { x: (WORLD_W - cpuLen) / 2, y: END, w: cpuLen, h: THICK, vx: 0, vy: 0, flash: 0, charge: 0 }
    : { x: WORLD_W - END - THICK, y: (WORLD_H - cpuLen) / 2, w: THICK, h: cpuLen, vx: 0, vy: 0, flash: 0, charge: 0 };
  const ball = { x: WORLD_W / 2, y: WORLD_H / 2, vx: 0, vy: 0, r: BALL_R, wobble: 0 };
  const particles: Particle[] = [];
  const floaters: Floater[] = [];
  const smears: Smear[] = [];
  const stains = makeStains();
  function makeStains(): { x: number; y: number; r: number; a: number }[] {
    const out = [];
    for (let i = 0; i < 18; i++) {
      out.push({ x: 80 + Math.random() * (WORLD_W - 160), y: 50 + Math.random() * (WORLD_H - 100), r: 18 + Math.random() * 70, a: 0.03 + Math.random() * 0.05 });
    }
    return out;
  }
  function emit(x: number, y: number, n: number, speed: number, dirx: number, diry: number): void {
    for (let i = 0; i < n; i++) {
      const ang = Math.atan2(diry, dirx) + (Math.random() - 0.5) * 1.4;
      const sp = speed * (0.4 + Math.random());
      particles.push({ x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: 0.25 + Math.random() * 0.4, max: 0.65, r: 1.5 + Math.random() * 3.2, a: 0.5 + Math.random() * 0.5 });
      if (particles.length > 140) particles.shift();
    }
  }
  function layout(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    const cssW = Math.max(1, rect.width);
    const cssH = Math.max(1, rect.height);
    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);
    const scale = Math.min(cssW / WORLD_W, cssH / WORLD_H);
    view = { scale, ox: (cssW - WORLD_W * scale) / 2, oy: (cssH - WORLD_H * scale) / 2, cssW, cssH };
  }
  function clientToWorld(cx: number, cy: number): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    return { x: (cx - rect.left - view.ox) / view.scale, y: (cy - rect.top - view.oy) / view.scale };
  }
  function pointerAlong(side: "p1" | "p2"): number | undefined {
    for (const p of ptrs.values()) if (p.side === side) return P ? p.x : p.y;
    return undefined;
  }
  function readAxis(side: "p1" | "p2"): number {
    if (pointerAlong(side) !== undefined) return 0;
    let v = touchAxis[side];
    if (P) {
      if (side === "p1") {
        if (keys.has("KeyA") || (cfg.mode !== "hotseat" && keys.has("ArrowLeft"))) v -= 1;
        if (keys.has("KeyD") || (cfg.mode !== "hotseat" && keys.has("ArrowRight"))) v += 1;
      } else {
        if (keys.has("ArrowLeft")) v -= 1;
        if (keys.has("ArrowRight")) v += 1;
      }
    } else if (side === "p1") {
      if (keys.has("KeyW") || (cfg.mode !== "hotseat" && keys.has("ArrowUp"))) v -= 1;
      if (keys.has("KeyS") || (cfg.mode !== "hotseat" && keys.has("ArrowDown"))) v += 1;
    } else {
      if (keys.has("ArrowUp")) v -= 1;
      if (keys.has("ArrowDown")) v += 1;
    }
    const pads = navigator.getGamepads?.() ?? [];
    for (const pad of pads) {
      if (!pad) continue;
      const lx = pad.axes[0] ?? 0; const ly = pad.axes[1] ?? 0; const rx = pad.axes[2] ?? 0; const ry = pad.axes[3] ?? 0;
      const dz = 0.18;
      if (side === "p1") {
        const axis = P ? lx : ly;
        if (Math.abs(axis) > dz) v += axis;
        if (!P) { if (pad.buttons[12]?.pressed) v -= 1; if (pad.buttons[13]?.pressed) v += 1; }
        else { if (pad.buttons[14]?.pressed) v -= 1; if (pad.buttons[15]?.pressed) v += 1; }
      } else {
        const axis = P ? rx : ry;
        if (Math.abs(axis) > dz) v += axis;
      }
    }
    return clamp(v, -1, 1);
  }
  function resetBall(): void {
    ball.x = WORLD_W / 2; ball.y = WORLD_H / 2; ball.vx = 0; ball.vy = 0; smears.length = 0; serveTimer = 0.85; message = "SERVE";
  }
  function setPrimary(primary: number, across: number, speed: number, minFrac = 0.42): void {
    const mag = Math.hypot(primary, across) || 1;
    let np = (primary / mag) * speed; let na = (across / mag) * speed;
    const minP = speed * minFrac;
    if (Math.abs(np) < minP) { np = minP * Math.sign(np || 1); const rest = Math.sqrt(Math.max(1, speed * speed - np * np)); na = rest * Math.sign(na || 1); }
    if (P) { ball.vx = na; ball.vy = np; } else { ball.vx = np; ball.vy = na; }
  }
  function applyCut(out: 1 | -1, theta: number, speed: number): void {
    const t = clamp(theta, -1.32, 1.32);
    const across = Math.sin(t) * speed; const along = Math.cos(t) * speed;
    if (P) { ball.vx = across; ball.vy = out * along; } else { ball.vx = out * along; ball.vy = across; }
  }
  function launch(): void {
    const speed = BASE + hits * 4; const jitter = (Math.random() - 0.5) * 0.9; const dir = serveDir;
    if (P) { let vy = -dir * speed; if (Math.abs(vy) < speed * 0.55) vy = -dir * speed * 0.55; setPrimary(vy, jitter * speed * 0.55, speed); }
    else { let vx = dir * speed; if (Math.abs(vx) < speed * 0.55) vx = dir * speed * 0.55; setPrimary(vx, jitter * speed * 0.55, speed); }
    message = ""; if (!cfg.getMuted()) sfxServe();
  }
  function hitPaddle(p: Paddle, out: 1 | -1): void {
    const smash = p.charge > 0.55;
    const speed = Math.min(MAX, Math.hypot(ball.vx, ball.vy) + (smash ? 90 : 32) + hits * 3);
    const alongVel = P ? p.vx : p.vy;
    const rel = P ? clamp((ball.x - (p.x + p.w / 2)) / (p.w / 2), -1, 1) : clamp((ball.y - (p.y + p.h / 2)) / (p.h / 2), -1, 1);
    const cut = Math.sign(rel) * Math.pow(Math.abs(rel), 0.55);
    const english = clamp(alongVel / 520, -1, 1);
    const incoming = P ? ball.vx : ball.vy;
    const carry = clamp(incoming / Math.max(140, speed), -0.35, 0.35);
    const t = clamp(cut * 0.96 + english * 0.48 + carry * 0.22, -1, 1);
    const max = smash ? 1.29 : 1.15;
    applyCut(out, t * max, speed);
    if (P) { ball.y = out < 0 ? p.y - ball.r - 0.5 : p.y + p.h + ball.r + 0.5; emit(ball.x, ball.y, smash ? 18 : 10, smash ? 280 : 180, rel, out); }
    else { ball.x = out > 0 ? p.x + p.w + ball.r + 0.5 : p.x - ball.r - 0.5; emit(ball.x, ball.y, smash ? 18 : 10, smash ? 280 : 180, out, rel); }
    p.flash = 1; p.charge = 0; hits += 1; smashGlow = smash ? 1 : 0.35; hitstop = smash ? 0.07 : 0.035; trauma = Math.min(1, trauma + (smash ? 0.55 : 0.28));
    floaters.push({ x: ball.x, y: ball.y - 16, text: smash ? "SMASH" : Math.abs(t) > 0.72 ? "CUT" : "+1", life: 0.55 });
    if (!cfg.getMuted()) sfxHit(speed, smash);
  }
  function collidePaddle(p: Paddle, incoming: number): boolean {
    if (ball.x + ball.r < p.x || ball.x - ball.r > p.x + p.w) return false;
    if (ball.y + ball.r < p.y || ball.y - ball.r > p.y + p.h) return false;
    if (P) { if (incoming < 0 && ball.vy >= 0) return false; if (incoming > 0 && ball.vy <= 0) return false; }
    else { if (incoming < 0 && ball.vx >= 0) return false; if (incoming > 0 && ball.vx <= 0) return false; }
    hitPaddle(p, incoming < 0 ? 1 : -1);
    return true;
  }
  function score(side: "you" | "them"): void {
    if (ended) return;
    if (side === "you") you += 1; else them += 1;
    trauma = Math.min(1, trauma + 0.5);
    emit(ball.x, ball.y, 22, 240, side === "you" ? 1 : -1, 0);
    if (!cfg.getMuted()) sfxScore(side === "you");
    serveDir = side === "you" ? 1 : -1;
    if (cfg.mode === "rally") { ended = true; message = "SPLAT"; cfg.onMatchEnd({ you, them, hits, won: false }); return; }
    const limit = POINTS_TO_WIN;
    if (you >= limit || them >= limit) { ended = true; message = you > them ? "CLEAN" : "GUNKED"; cfg.onMatchEnd({ you, them, hits, won: you > them }); return; }
    resetBall();
  }
  function movePaddle(p: Paddle, axis: number, dt: number, along?: number): void {
    if (P) {
      const prev = p.x;
      if (along !== undefined) p.x = along - p.w / 2; else p.x += axis * 460 * dt;
      p.x = clamp(p.x, MARGIN, WORLD_W - MARGIN - p.w);
      p.vx = (p.x - prev) / dt; p.vy = 0;
      if (Math.abs(p.vx) < 40) p.charge = Math.min(1, p.charge + dt * 1.35); else p.charge = Math.max(0, p.charge - dt * 2.4);
    } else {
      const prev = p.y;
      if (along !== undefined) p.y = along - p.h / 2; else p.y += axis * 460 * dt;
      p.y = clamp(p.y, MARGIN, WORLD_H - MARGIN - p.h);
      p.vy = (p.y - prev) / dt; p.vx = 0;
      if (Math.abs(p.vy) < 40) p.charge = Math.min(1, p.charge + dt * 1.35); else p.charge = Math.max(0, p.charge - dt * 2.4);
    }
    p.flash = Math.max(0, p.flash - dt * 4);
    if (serveTimer > 0) p.charge = 0;
  }
  function stepCpu(dt: number): void {
    if (cfg.mode !== "pit") return;
    if (P) {
      const incoming = ball.vy < 0 && serveTimer <= 0;
      let target = WORLD_W / 2;
      if (incoming) {
        const t = ((cpu.y - ball.y) / Math.min(-40, ball.vy)) * cfg.cpu.predict;
        target = predictBounce(ball.x, ball.vx, Math.max(0, t), MARGIN + ball.r, WORLD_W - MARGIN - ball.r);
        target += (Math.random() - 0.5) * cfg.cpu.error;
      }
      const desired = target - cpu.w / 2; const dx = desired - cpu.x; const max = cfg.cpu.speed * dt; const prev = cpu.x;
      cpu.x = clamp(cpu.x + clamp(dx, -max, max), MARGIN, WORLD_W - MARGIN - cpu.w);
      cpu.vx = (cpu.x - prev) / dt; cpu.flash = Math.max(0, cpu.flash - dt * 4);
      if (Math.abs(cpu.vx) < 40) cpu.charge = Math.min(1, cpu.charge + dt * 0.9); else cpu.charge = Math.max(0, cpu.charge - dt * 2);
      return;
    }
    const incoming = ball.vx > 0 && serveTimer <= 0;
    let target = WORLD_H / 2;
    if (incoming) {
      const t = ((cpu.x - ball.x) / Math.max(40, ball.vx)) * cfg.cpu.predict;
      target = predictBounce(ball.y, ball.vy, Math.max(0, t), MARGIN + ball.r, WORLD_H - MARGIN - ball.r);
      target += (Math.random() - 0.5) * cfg.cpu.error;
    }
    const desired = target - cpu.h / 2; const dy = desired - cpu.y; const max = cfg.cpu.speed * dt; const prev = cpu.y;
    cpu.y = clamp(cpu.y + clamp(dy, -max, max), MARGIN, WORLD_H - MARGIN - cpu.h);
    cpu.vy = (cpu.y - prev) / dt; cpu.flash = Math.max(0, cpu.flash - dt * 4);
    if (Math.abs(cpu.vy) < 40) cpu.charge = Math.min(1, cpu.charge + dt * 0.9); else cpu.charge = Math.max(0, cpu.charge - dt * 2);
  }
  function step(dt: number): void {
    time += dt; trauma = Math.max(0, trauma - dt * 1.8); smashGlow = Math.max(0, smashGlow - dt * 2.2);
    if (serveTimer > 0) { serveTimer -= dt; if (serveTimer <= 0 && !ended) launch(); }
    movePaddle(player, readAxis("p1"), dt, pointerAlong("p1"));
    if (cfg.mode === "hotseat") movePaddle(cpu, readAxis("p2"), dt, pointerAlong("p2"));
    else if (cfg.mode === "rally") {
      if (P) { cpu.x = MARGIN; cpu.w = WORLD_W - MARGIN * 2; cpu.y = WALL; cpu.h = 16; }
      else { cpu.y = MARGIN; cpu.h = WORLD_H - MARGIN * 2; cpu.x = WALL; cpu.w = 16; }
    } else stepCpu(dt);
    if (serveTimer <= 0 && !ended) {
      ball.x += ball.vx * dt; ball.y += ball.vy * dt; ball.wobble += dt * 14;
      smears.push({ x: ball.x, y: ball.y, a: 0.28, r: ball.r * 0.72 }); if (smears.length > 14) smears.shift();
      if (P) {
        const left = MARGIN + ball.r; const right = WORLD_W - MARGIN - ball.r;
        if (ball.x < left && ball.vx < 0) { ball.x = left; ball.vx *= -1; if (!cfg.getMuted()) sfxWall(); trauma = Math.min(1, trauma + 0.12); emit(ball.x, ball.y, 6, 120, 1, 0); }
        else if (ball.x > right && ball.vx > 0) { ball.x = right; ball.vx *= -1; if (!cfg.getMuted()) sfxWall(); trauma = Math.min(1, trauma + 0.12); emit(ball.x, ball.y, 6, 120, -1, 0); }
        collidePaddle(player, 1);
        if (cfg.mode === "rally") {
          const wallY = WALL;
          if (ball.y - ball.r < wallY && ball.vy < 0) {
            ball.y = wallY + ball.r; ball.vy *= -1; hits += 1; trauma = Math.min(1, trauma + 0.16);
            emit(ball.x, ball.y, 8, 160, 0, 1); floaters.push({ x: ball.x, y: ball.y + 20, text: `${hits}`, life: 0.4 });
            if (!cfg.getMuted()) sfxWall();
            if (hits >= cfg.rallyTarget) { ended = true; message = "QUOTA"; you = 1; cfg.onMatchEnd({ you: 1, them: 0, hits, won: true }); }
          }
        } else collidePaddle(cpu, -1);
        if (ball.y - ball.r > WORLD_H) score("them");
        else if (cfg.mode !== "rally" && ball.y + ball.r < 0) score("you");
      } else {
        const top = MARGIN + ball.r; const bot = WORLD_H - MARGIN - ball.r;
        if (ball.y < top && ball.vy < 0) { ball.y = top; ball.vy *= -1; if (!cfg.getMuted()) sfxWall(); trauma = Math.min(1, trauma + 0.12); emit(ball.x, ball.y, 6, 120, 0, 1); }
        else if (ball.y > bot && ball.vy > 0) { ball.y = bot; ball.vy *= -1; if (!cfg.getMuted()) sfxWall(); trauma = Math.min(1, trauma + 0.12); emit(ball.x, ball.y, 6, 120, 0, -1); }
        collidePaddle(player, -1);
        if (cfg.mode === "rally") {
          const wallX = WALL;
          if (ball.x + ball.r > wallX && ball.vx > 0) {
            ball.x = wallX - ball.r; ball.vx *= -1; hits += 1; trauma = Math.min(1, trauma + 0.16);
            emit(ball.x, ball.y, 8, 160, -1, 0); floaters.push({ x: ball.x - 20, y: ball.y, text: `${hits}`, life: 0.4 });
            if (!cfg.getMuted()) sfxWall();
            if (hits >= cfg.rallyTarget) { ended = true; message = "QUOTA"; you = 1; cfg.onMatchEnd({ you: 1, them: 0, hits, won: true }); }
          }
        } else collidePaddle(cpu, 1);
        if (ball.x + ball.r < 0) score("them");
        else if (cfg.mode !== "rally" && ball.x - ball.r > WORLD_W) score("you");
      }
    }
    for (const s of smears) s.a -= dt * 1.6;
    for (let i = smears.length - 1; i >= 0; i--) if (smears[i]!.a <= 0) smears.splice(i, 1);
    if (serveTimer <= 0 && Math.random() < dt * 18) {
      particles.push({ x: ball.x, y: ball.y, vx: -ball.vx * 0.08, vy: -ball.vy * 0.08 + (Math.random() - 0.5) * 20, life: 0.28, max: 0.28, r: 2.4, a: 0.45 });
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]!; p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 80 * dt; if (p.life <= 0) particles.splice(i, 1);
    }
    for (let i = floaters.length - 1; i >= 0; i--) {
      const f = floaters[i]!; f.life -= dt; f.y -= 28 * dt; if (f.life <= 0) floaters.splice(i, 1);
    }
    hudTick += dt;
    if (hudTick > 0.08 || message) {
      hudTick = 0;
      cfg.onHud({ you, them, hits, charge: player.charge, serving: serveTimer > 0, smash: smashGlow, rallyTarget: cfg.rallyTarget, message });
    }
  }
  function roundRectLocal(x: number, y: number, w: number, h: number, r: number): void {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath(); ctx.moveTo(x + rr, y); ctx.arcTo(x + w, y, x + w, y + h, rr); ctx.arcTo(x + w, y + h, x, y + h, rr); ctx.arcTo(x, y + h, x, y, rr); ctx.arcTo(x, y, x + w, y, rr); ctx.closePath();
  }
  function drawPaddle(p: Paddle, mirror: boolean): void {
    const g = P ? ctx.createLinearGradient(p.x, p.y, p.x, p.y + p.h) : ctx.createLinearGradient(p.x, p.y, p.x + p.w, p.y);
    g.addColorStop(0, mirror ? "#2a2722" : "#3a362f"); g.addColorStop(1, mirror ? "#3a362f" : "#2a2722");
    ctx.fillStyle = g; roundRectLocal(p.x, p.y, p.w, p.h, 4); ctx.fill();
    ctx.fillStyle = "rgba(232,228,216,0.12)";
    for (let i = 0; i < 3; i++) {
      const t = 0.22 + i * 0.28; ctx.beginPath();
      if (P) ctx.arc(p.x + p.w * t, p.y + p.h / 2, 1.6, 0, Math.PI * 2); else ctx.arc(p.x + p.w / 2, p.y + p.h * t, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
    if (p.flash > 0) { ctx.fillStyle = `rgba(158,196,90,${0.35 * p.flash})`; roundRectLocal(p.x, p.y, p.w, p.h, 4); ctx.fill(); }
    if (p.charge > 0.05 && cfg.mode !== "rally") {
      ctx.fillStyle = `rgba(158,196,90,${0.15 + p.charge * 0.55})`;
      if (P) { const cw = p.w * p.charge; roundRectLocal(p.x + (p.w - cw) / 2, p.y + 3, cw, p.h - 6, 2); }
      else { const ch = p.h * p.charge; roundRectLocal(p.x + 3, p.y + p.h - ch - 4, p.w - 6, ch, 2); }
      ctx.fill();
    }
    ctx.fillStyle = "rgba(158,196,90,0.35)";
    const drip = 6 + Math.sin(time * 3 + p.x) * 3; ctx.beginPath();
    if (P) ctx.ellipse(p.x + p.w / 2, mirror ? p.y - drip * 0.2 : p.y + p.h + drip * 0.2, drip, 3.2, 0, 0, Math.PI * 2);
    else ctx.ellipse(p.x + p.w / 2, p.y + p.h + drip * 0.2, 3.2, drip, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  function drawBall(): void {
    const speed = Math.hypot(ball.vx, ball.vy); const stretch = Math.min(0.42, speed / 980); const ang = Math.atan2(ball.vy, ball.vx);
    ctx.save(); ctx.translate(ball.x, ball.y); ctx.rotate(ang); const wob = 1 + Math.sin(ball.wobble) * 0.08; ctx.scale(1 + stretch, (1 - stretch * 0.55) * wob);
    ctx.fillStyle = "#9ec45a"; ctx.beginPath(); ctx.ellipse(0, 0, ball.r + 1, ball.r * 0.92, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(18,20,12,0.28)"; ctx.beginPath(); ctx.ellipse(ball.r * 0.15, ball.r * 0.12, ball.r * 0.55, ball.r * 0.4, 0.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(232,228,216,0.38)"; ctx.beginPath(); ctx.ellipse(-ball.r * 0.28, -ball.r * 0.32, ball.r * 0.32, ball.r * 0.22, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(158,196,90,0.7)"; ctx.lineWidth = 1.3; ctx.lineCap = "round"; ctx.beginPath();
    ctx.moveTo(-ball.r * 0.15, -ball.r * 0.4); ctx.quadraticCurveTo(-ball.r * 1.05, -ball.r * 1.05, -ball.r * 1.45, -ball.r * 0.55);
    ctx.moveTo(-ball.r * 0.1, ball.r * 0.15); ctx.quadraticCurveTo(-ball.r * 1.15, ball.r * 0.35, -ball.r * 1.4, -0.05); ctx.stroke();
    ctx.restore();
  }
  function render(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, view.cssW, view.cssH);
    ctx.fillStyle = "#0c0b0a"; ctx.fillRect(0, 0, view.cssW, view.cssH);
    ctx.save(); ctx.translate(view.ox, view.oy); ctx.scale(view.scale, view.scale);
    const shakeOn = cfg.shake && !cfg.reducedMotion; const shakeAmt = shakeOn ? trauma * trauma : 0;
    if (shakeAmt > 0) { ctx.translate((Math.random() - 0.5) * 14 * shakeAmt, (Math.random() - 0.5) * 10 * shakeAmt); ctx.rotate((Math.random() - 0.5) * 0.025 * shakeAmt); }
    ctx.fillStyle = "#12110f"; ctx.fillRect(0, 0, WORLD_W, WORLD_H);
    for (const s of stains) { ctx.fillStyle = `rgba(40, 36, 28, ${s.a})`; ctx.beginPath(); ctx.ellipse(s.x, s.y, s.r, s.r * 0.7, 0.4, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = "#1a1815";
    if (P) {
      ctx.fillRect(0, 0, MARGIN, WORLD_H); ctx.fillRect(WORLD_W - MARGIN, 0, MARGIN, WORLD_H);
      ctx.fillStyle = "rgba(232,228,216,0.045)";
      for (let y = 28; y < WORLD_H; y += 46) { ctx.fillRect(0, y, MARGIN, 3); ctx.fillRect(WORLD_W - MARGIN, y, MARGIN, 3); }
    } else {
      ctx.fillRect(0, 0, WORLD_W, MARGIN); ctx.fillRect(0, WORLD_H - MARGIN, WORLD_W, MARGIN);
      ctx.fillStyle = "rgba(232,228,216,0.045)";
      for (let x = 28; x < WORLD_W; x += 46) { ctx.fillRect(x, 0, 3, MARGIN); ctx.fillRect(x, WORLD_H - MARGIN, 3, MARGIN); }
    }
    ctx.strokeStyle = "rgba(232,228,216,0.08)"; ctx.lineWidth = 2; ctx.setLineDash([10, 14]); ctx.beginPath();
    if (P) { ctx.moveTo(MARGIN + 8, WORLD_H / 2); ctx.lineTo(WORLD_W - MARGIN - 8, WORLD_H / 2); }
    else { ctx.moveTo(WORLD_W / 2, MARGIN + 8); ctx.lineTo(WORLD_W / 2, WORLD_H - MARGIN - 8); }
    ctx.stroke(); ctx.setLineDash([]);
    ctx.font = P ? "700 72px 'Bebas Neue', sans-serif" : "700 92px 'Bebas Neue', sans-serif"; ctx.textAlign = "center"; ctx.fillStyle = "rgba(232,228,216,0.05)";
    if (cfg.mode === "rally") ctx.fillText(`${hits} / ${cfg.rallyTarget}`, WORLD_W / 2, WORLD_H / 2 + 24);
    else if (P) { ctx.fillText(`${them}`, WORLD_W / 2, WORLD_H * 0.28); ctx.fillText(`${you}`, WORLD_W / 2, WORLD_H * 0.72); }
    else { ctx.fillText(`${you}`, WORLD_W * 0.32, WORLD_H / 2 + 32); ctx.fillText(`${them}`, WORLD_W * 0.68, WORLD_H / 2 + 32); }
    if (cfg.mode === "rally") {
      ctx.fillStyle = "#2a2722";
      if (P) { ctx.fillRect(MARGIN, WALL - 8, WORLD_W - MARGIN * 2, 16); ctx.fillStyle = "rgba(158,196,90,0.35)"; ctx.fillRect(MARGIN, WALL - 2, WORLD_W - MARGIN * 2, 4); }
      else { ctx.fillRect(WALL, MARGIN, 16, WORLD_H - MARGIN * 2); ctx.fillStyle = "rgba(158,196,90,0.35)"; ctx.fillRect(WALL + 6, MARGIN, 4, WORLD_H - MARGIN * 2); }
    }
    drawPaddle(player, false); if (cfg.mode !== "rally") drawPaddle(cpu, true);
    for (const s of smears) { ctx.fillStyle = `rgba(158,196,90,${Math.max(0, s.a * 0.45)})`; ctx.beginPath(); ctx.ellipse(s.x, s.y, s.r, s.r * 0.62, 0.3, 0, Math.PI * 2); ctx.fill(); }
    for (const p of particles) { const k = p.life / p.max; ctx.fillStyle = `rgba(158,196,90,${p.a * k})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * k, 0, Math.PI * 2); ctx.fill(); }
    if (serveTimer <= 0 || message === "SERVE") drawBall();
    ctx.font = "500 14px 'IBM Plex Mono', monospace"; ctx.textAlign = "center";
    for (const f of floaters) { ctx.fillStyle = `rgba(232,228,216,${Math.max(0, f.life * 2)})`; ctx.fillText(f.text, f.x, f.y); }
    if (message && message !== "SERVE") { ctx.font = "400 72px 'Bebas Neue', sans-serif"; ctx.fillStyle = "rgba(232,228,216,0.88)"; ctx.fillText(message, WORLD_W / 2, WORLD_H / 2 + 24); }
    else if (serveTimer > 0.15) { ctx.font = "400 48px 'Bebas Neue', sans-serif"; ctx.fillStyle = "rgba(158,196,90,0.85)"; ctx.fillText("SERVE", WORLD_W / 2, WORLD_H / 2 + 16); }
    const vig = ctx.createRadialGradient(WORLD_W / 2, WORLD_H / 2, WORLD_H * 0.2, WORLD_W / 2, WORLD_H / 2, Math.max(WORLD_W, WORLD_H) * 0.62);
    vig.addColorStop(0, "rgba(0,0,0,0)"); vig.addColorStop(1, "rgba(8,7,6,0.55)"); ctx.fillStyle = vig; ctx.fillRect(0, 0, WORLD_W, WORLD_H);
    ctx.restore();
  }
  function loop(now: number): void {
    if (!alive) return;
    const raw = Math.min(0.1, (now - last) / 1000); last = now;
    if (!paused) {
      if (hitstop > 0) hitstop -= raw;
      else { acc += raw; let steps = 0; while (acc >= STEP && steps < MAX_STEPS) { step(STEP); acc -= STEP; steps += 1; } }
    }
    render(); raf = requestAnimationFrame(loop);
  }
  function onKeyDown(e: KeyboardEvent): void {
    const game = new Set(["KeyW","KeyS","KeyA","KeyD","ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Space","KeyP","Escape"]);
    if (game.has(e.code)) e.preventDefault(); keys.add(e.code);
  }
  function onKeyUp(e: KeyboardEvent): void { keys.delete(e.code); }
  function onBlur(): void { keys.clear(); touchAxis.p1 = 0; touchAxis.p2 = 0; ptrs.clear(); }
  function onVis(): void { if (document.visibilityState !== "visible") onBlur(); }
  function assignSide(w: { x: number; y: number }): "p1" | "p2" {
    if (cfg.mode !== "hotseat") return "p1";
    if (P) return w.y < WORLD_H / 2 ? "p2" : "p1";
    return w.x > WORLD_W / 2 ? "p2" : "p1";
  }
  function onPointerDown(e: PointerEvent): void {
    if (e.cancelable) e.preventDefault();
    const w = clientToWorld(e.clientX, e.clientY);
    ptrs.set(e.pointerId, { id: e.pointerId, side: assignSide(w), x: w.x, y: w.y });
    try { canvas.setPointerCapture(e.pointerId); } catch { /* iOS Safari */ }
  }
  function onPointerMove(e: PointerEvent): void {
    const slot = ptrs.get(e.pointerId); if (!slot) return;
    const w = clientToWorld(e.clientX, e.clientY); slot.x = w.x; slot.y = w.y;
  }
  function onPointerUp(e: PointerEvent): void { ptrs.delete(e.pointerId); }
  const ro = new ResizeObserver(() => layout());
  ro.observe(canvas); layout();
  window.addEventListener("keydown", onKeyDown); window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur); document.addEventListener("visibilitychange", onVis);
  canvas.addEventListener("pointerdown", onPointerDown, { passive: false });
  window.addEventListener("pointermove", onPointerMove); window.addEventListener("pointerup", onPointerUp); window.addEventListener("pointercancel", onPointerUp);
  raf = requestAnimationFrame(loop);
  cfg.onHud({ you: 0, them: 0, hits: 0, charge: 0, serving: true, smash: 0, rallyTarget: cfg.rallyTarget, message: "SERVE" });
  return {
    destroy() {
      alive = false; cancelAnimationFrame(raf); ro.disconnect();
      window.removeEventListener("keydown", onKeyDown); window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur); document.removeEventListener("visibilitychange", onVis);
      canvas.removeEventListener("pointerdown", onPointerDown); window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp); window.removeEventListener("pointercancel", onPointerUp);
    },
    pause() { paused = true; },
    resume() { paused = false; last = performance.now(); },
    isPaused: () => paused,
    setTouchAxis(side, value) { touchAxis[side] = value; },
  };
}
