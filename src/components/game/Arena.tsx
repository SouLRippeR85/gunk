import { Pause, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { startEngine, type EngineHandle } from "@/lib/game/engine";
import { useGunk } from "@/lib/game/store";
import {
  formatChips,
  formatOdds,
  opponentById,
  rallyById,
  settlePayout,
  tableLabel,
  type HudState,
  type MatchResult,
} from "@/lib/game/types";

const EMPTY_HUD: HudState = {
  you: 0,
  them: 0,
  hits: 0,
  charge: 0,
  serving: true,
  smash: 0,
  rallyTarget: 0,
  message: "",
};

export function Arena() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<EngineHandle | null>(null);
  const settled = useRef(false);
  const endTimer = useRef(0);
  const [layoutKey, setLayoutKey] = useState(0);
  const [portrait, setPortrait] = useState(true);

  const mode = useGunk((s) => s.mode);
  const opponentId = useGunk((s) => s.opponentId);
  const rallyId = useGunk((s) => s.rallyId);
  const stake = useGunk((s) => s.stake);
  const shake = useGunk((s) => s.shake);
  const muted = useGunk((s) => s.muted);
  const toggleMuted = useGunk((s) => s.toggleMuted);
  const toggleShake = useGunk((s) => s.toggleShake);
  const settle = useGunk((s) => s.settle);

  const [hud, setHud] = useState<HudState>(EMPTY_HUD);
  const [paused, setPaused] = useState(false);
  const [foldAsk, setFoldAsk] = useState(false);
  const [hint, setHint] = useState(true);

  const opponent = opponentById(opponentId);
  const rally = rallyById(rallyId);
  const odds = mode === "rally" ? rally.odds : mode === "hotseat" ? 1 : opponent.odds;
  const liveStake = mode === "hotseat" ? 0 : stake;

  function applyResult(
    payload: { you: number; them: number; hits: number; won: boolean },
    forfeited = false,
  ) {
    if (settled.current) return;
    settled.current = true;
    const won = forfeited ? false : payload.won;
    const { payout, delta } = settlePayout(mode, won, liveStake, odds);
    const result: MatchResult = {
      won,
      forfeited,
      you: payload.you,
      them: payload.them,
      hits: payload.hits,
      stake: liveStake,
      odds,
      payout,
      delta,
      label: tableLabel(mode, opponentId, rallyId) + (forfeited ? " \u00b7 fold" : ""),
      mode,
    };
    settle(result);
  }

  useEffect(() => {
    const read = () => window.innerHeight > window.innerWidth;
    let last = read();
    setPortrait(last);
    function onResize() {
      const next = read();
      if (next !== last) {
        last = next;
        setPortrait(next);
        setLayoutKey((k) => k + 1);
      }
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    settled.current = false;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const engine = startEngine({
      canvas,
      mode,
      cpu: opponent,
      rallyTarget: rally.hits,
      reducedMotion: reduced,
      shake,
      portrait: window.innerHeight > window.innerWidth,
      getMuted: () => useGunk.getState().muted,
      onHud: (next) => {
        setHud(next);
        if (next.hits > 0) setHint(false);
      },
      onMatchEnd: (payload) => {
        window.clearTimeout(endTimer.current);
        endTimer.current = window.setTimeout(() => applyResult(payload), 850);
      },
    });
    engineRef.current = engine;
    return () => {
      window.clearTimeout(endTimer.current);
      engine.destroy();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutKey]);

  useEffect(() => {
    const t = window.setTimeout(() => setHint(false), 3200);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.code !== "KeyP" && e.code !== "Escape") return;
      e.preventDefault();
      setPaused((p) => {
        const next = !p;
        if (next) engineRef.current?.pause();
        else {
          setFoldAsk(false);
          engineRef.current?.resume();
        }
        return next;
      });
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function togglePause() {
    setPaused((p) => {
      const next = !p;
      if (next) engineRef.current?.pause();
      else {
        setFoldAsk(false);
        engineRef.current?.resume();
      }
      return next;
    });
  }

  function fold() {
    applyResult({ you: hud.you, them: hud.them, hits: hud.hits, won: false }, true);
  }

  const themName = mode === "rally" ? "WALL" : mode === "hotseat" ? "P2" : opponent.name.toUpperCase();
  const hintCopy = portrait
    ? mode === "hotseat"
      ? "Bottom is you \u00b7 top is P2"
      : "Drag \u00b7 edges cut"
    : mode === "hotseat"
      ? "Drag your side \u00b7 P2 arrows"
      : "Edges cut \u00b7 W/S";

  return (
    <div className="gunk-play relative flex h-dvh w-full min-w-0 flex-col overflow-hidden bg-bg text-fg">
      <header className="gunk-hud pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-2">
        <div className="pointer-events-auto">
          <Button variant="ghost" size="icon" aria-label="Pause" onClick={togglePause}>
            <Pause />
          </Button>
        </div>
        <div className="min-w-0 pt-1 text-center">
          {mode === "rally" ? (
            <p className="font-display text-3xl leading-none tracking-wide tabular-nums">
              {hud.hits}
              <span className="text-muted"> / {rally.hits}</span>
            </p>
          ) : (
            <p className="font-display text-3xl leading-none tracking-wide tabular-nums">
              {hud.you}
              <span className="mx-2 text-muted">\u2014</span>
              {hud.them}
            </p>
          )}
          <p className="mt-1 truncate font-mono text-xs tracking-wide text-muted uppercase">
            {mode === "rally" ? "YOU \u00b7 WALL" : `YOU \u00b7 ${themName}`}
            {liveStake > 0 ? ` \u00b7 ${formatChips(liveStake)} @ ${formatOdds(odds)}` : ""}
          </p>
        </div>
        <div className="pointer-events-auto">
          <Button variant="ghost" size="icon" aria-label={muted ? "Unmute" : "Mute"} onClick={toggleMuted}>
            {muted ? <VolumeX /> : <Volume2 />}
          </Button>
        </div>
      </header>

      {hud.charge > 0.55 && !hud.serving && !paused ? (
        <p className="pointer-events-none absolute top-20 left-1/2 z-10 -translate-x-1/2 font-mono text-xs tracking-[0.2em] text-accent uppercase">
          Smash charged
        </p>
      ) : null}

      <div className="relative min-h-0 flex-1">
        <canvas ref={canvasRef} className="block h-full w-full touch-none" aria-label="Gunk arena" />
      </div>

      {hint ? (
        <p className="gunk-hint pointer-events-none absolute inset-x-0 z-10 text-center font-mono text-xs text-faint">
          {hintCopy}
        </p>
      ) : null}

      {paused ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-bg/80 px-4">
          <div className="w-full max-w-sm rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]">
            <h2 className="font-display text-4xl tracking-wide">Paused</h2>
            <p className="mt-2 text-sm text-muted">
              {liveStake > 0 ? "Folding burns the stake already on the glass." : "P or Escape to resume."}
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <Button size="lg" className="w-full" onClick={() => { setFoldAsk(false); setPaused(false); engineRef.current?.resume(); }}>
                Resume
              </Button>
              <Button size="lg" variant="ghost" className="w-full" onClick={toggleShake}>
                Screen shake \u00b7 {shake ? "on" : "off"}
              </Button>
              {liveStake > 0 ? (
                foldAsk ? (
                  <Button size="lg" variant="danger" className="w-full" onClick={fold}>Confirm fold</Button>
                ) : (
                  <Button size="lg" variant="muted" className="w-full" onClick={() => setFoldAsk(true)}>Fold table</Button>
                )
              ) : (
                <Button size="lg" variant="muted" className="w-full" onClick={() => applyResult({ you: hud.you, them: hud.them, hits: hud.hits, won: false }, true)}>
                  Leave table
                </Button>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
