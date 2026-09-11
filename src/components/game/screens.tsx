import { ChevronLeft, Swords, Target, Users } from "lucide-react";
import { useEffect } from "react";
import { RoachMark } from "@/components/game/RoachMark";
import { MuteButton, Panel, ScreenFrame, TopBar, VaultChip, WalletButton } from "@/components/game/ui";
import { Button } from "@/components/ui/button";
import { sfxLose, sfxWin, unlockAudio } from "@/lib/game/audio";
import { useGunk } from "@/lib/game/store";
import {
  BROKE_LINE, DUMPSTER_DIVE, OPPONENTS, RALLY_TABLES, STAKES,
  formatChips, formatOdds, opponentById, rallyById,
} from "@/lib/game/types";
import { cn } from "@/lib/utils";

export function TitleScreen() {
  const setScreen = useGunk((s) => s.setScreen);
  const stats = useGunk((s) => s.stats);
  const history = useGunk((s) => s.history);
  const bankroll = useGunk((s) => s.bankroll);
  const dumpsterDive = useGunk((s) => s.dumpsterDive);
  const live = useGunk((s) => s.live);
  const broke = bankroll < BROKE_LINE;
  return (
    <ScreenFrame>
      <header className="relative z-10 flex items-center justify-between gap-2 pt-1">
        <VaultChip />
        <div className="flex items-center gap-1"><WalletButton /><MuteButton /></div>
      </header>
      <div className="gunk-stagger relative z-10 flex flex-1 flex-col justify-center py-5">
        <RoachMark className="mb-4 size-12 text-accent sm:mb-5 sm:size-14" />
        <p className="mb-2 font-mono text-xs font-medium tracking-[0.28em] text-accent uppercase">ROACH arcade</p>
        <h1 className="font-display text-6xl leading-none tracking-wide text-fg sm:text-8xl">GUNK</h1>
        <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted sm:mt-4 sm:text-base">
          Pong with a smear. Drop paper $ROACH in the pit \u2014 first to five, or cash a rally. Buy live on Atmos when you want the real thing.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:mt-8">
          <Button size="lg" className="w-full" onClick={() => { unlockAudio(); setScreen("mode"); }}>Enter the pit</Button>
          <Button size="lg" variant="ghost" className="w-full" onClick={() => setScreen("buy")}>Buy $ROACH</Button>
          {broke && !live ? (
            <Button size="lg" variant="muted" className="w-full" onClick={() => dumpsterDive()}>Dumpster dive \u00b7 +{DUMPSTER_DIVE}</Button>
          ) : null}
          <button type="button" className="mt-1 font-mono text-xs tracking-[0.2em] text-muted uppercase" onClick={() => setScreen("rules")}>House rules</button>
        </div>
      </div>
      <footer className="relative z-10 mt-auto space-y-3 pb-2">
        <p className="font-mono text-xs tabular-nums text-faint">
          {stats.played === 0
            ? live ? "Live vault. Buys land from Atmos." : "Vault starts at 1,000 paper ROACH. Play now \u2014 connect StarKey to buy live."
            : `${stats.won}W \u00b7 ${stats.lost}L \u00b7 wagered ${formatChips(stats.totalWagered)}`}
        </p>
        {history.length > 0 ? (
          <ul className="flex flex-col gap-1">
            {history.slice(0, 3).map((h) => (
              <li key={h.t} className="flex items-center justify-between gap-3 font-mono text-xs tabular-nums text-muted">
                <span className="min-w-0 truncate">{h.label}</span>
                <span className={h.delta >= 0 ? "text-accent" : "text-danger"}>{h.delta >= 0 ? "+" : ""}{formatChips(h.delta)}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </footer>
    </ScreenFrame>
  );
}

export function ModeScreen() {
  const setScreen = useGunk((s) => s.setScreen);
  const setMode = useGunk((s) => s.setMode);
  function pick(mode: "pit" | "rally" | "hotseat") { unlockAudio(); setMode(mode); setScreen("wager"); }
  return (
    <ScreenFrame>
      <TopBar left={<Button variant="ghost" size="icon" aria-label="Back" onClick={() => setScreen("title")}><ChevronLeft /></Button>} />
      <div className="gunk-stagger relative z-10 flex flex-1 flex-col justify-center gap-3 py-5">
        <p className="font-mono text-xs tracking-[0.22em] text-muted uppercase">Choose a table</p>
        <h2 className="font-display text-4xl tracking-wide text-fg">Where do you drop?</h2>
        <button type="button" onClick={() => pick("pit")} className="min-h-14 text-left">
          <Panel className="flex items-start gap-3 transition-colors duration-150 hover:bg-raised">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-raised text-accent"><Swords className="size-5" /></span>
            <span className="min-w-0"><span className="block font-medium text-fg">The Pit</span><span className="mt-1 block text-sm leading-relaxed text-muted">Versus a roach. First to five. Winner takes the slip.</span></span>
          </Panel>
        </button>
        <button type="button" onClick={() => pick("rally")} className="min-h-14 text-left">
          <Panel className="flex items-start gap-3 transition-colors duration-150 hover:bg-raised">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-raised text-accent"><Target className="size-5" /></span>
            <span className="min-w-0"><span className="block font-medium text-fg">Rally</span><span className="mt-1 block text-sm leading-relaxed text-muted">Hit the quota against a wall. Miss once and the stake smears.</span></span>
          </Panel>
        </button>
        <button type="button" onClick={() => pick("hotseat")} className="min-h-14 text-left">
          <Panel className="flex items-start gap-3 transition-colors duration-150 hover:bg-raised">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-raised text-accent"><Users className="size-5" /></span>
            <span className="min-w-0"><span className="block font-medium text-fg">Hotseat</span><span className="mt-1 block text-sm leading-relaxed text-muted">Two scrapers, one glass. Vault stays out of it \u2014 settle in person.</span></span>
          </Panel>
        </button>
      </div>
    </ScreenFrame>
  );
}

export function WagerScreen() {
  const mode = useGunk((s) => s.mode);
  const opponentId = useGunk((s) => s.opponentId);
  const rallyId = useGunk((s) => s.rallyId);
  const stake = useGunk((s) => s.stake);
  const bankroll = useGunk((s) => s.bankroll);
  const live = useGunk((s) => s.live);
  const setScreen = useGunk((s) => s.setScreen);
  const setOpponent = useGunk((s) => s.setOpponent);
  const setRally = useGunk((s) => s.setRally);
  const setStake = useGunk((s) => s.setStake);
  const startMatch = useGunk((s) => s.startMatch);
  const odds = useGunk((s) => s.currentOdds());
  const affordable = STAKES.filter((n) => n <= bankroll);
  const canDrop = mode === "hotseat" || (stake <= bankroll && stake > 0);
  const payout = mode === "hotseat" ? 0 : Math.round(stake * odds);
  function drop() { unlockAudio(); if (!startMatch()) return; }
  return (
    <ScreenFrame>
      <TopBar left={<Button variant="ghost" size="icon" aria-label="Back" onClick={() => setScreen("mode")}><ChevronLeft /></Button>} />
      <div className="relative z-10 flex flex-1 flex-col gap-4 py-4">
        {mode === "pit" ? (
          <section>
            <p className="mb-2 font-mono text-xs tracking-[0.22em] text-muted uppercase">Opponent</p>
            <div className="flex flex-col gap-2">
              {OPPONENTS.map((o) => (
                <button key={o.id} type="button" onClick={() => setOpponent(o.id)} className="text-left">
                  <Panel active={o.id === opponentId} className={cn("border-l-2 py-2.5", o.id === opponentId ? "border-l-accent bg-raised" : "border-l-transparent")}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-medium text-fg">{o.name}</span>
                      <span className="font-mono text-sm tabular-nums text-accent">{formatOdds(o.odds)}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted sm:text-sm">{o.tag} \u00b7 {o.blurb}</p>
                  </Panel>
                </button>
              ))}
            </div>
          </section>
        ) : null}
        {mode === "rally" ? (
          <section>
            <p className="mb-2 font-mono text-xs tracking-[0.22em] text-muted uppercase">Quota</p>
            <div className="flex flex-col gap-2">
              {RALLY_TABLES.map((t) => (
                <button key={t.id} type="button" onClick={() => setRally(t.id)} className="text-left">
                  <Panel active={t.id === rallyId} className={cn("border-l-2 py-2.5", t.id === rallyId ? "border-l-accent bg-raised" : "border-l-transparent")}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-medium text-fg">{t.name}</span>
                      <span className="font-mono text-sm tabular-nums text-accent">{formatOdds(t.odds)}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted sm:text-sm">{t.hits} hits \u00b7 {t.blurb}</p>
                  </Panel>
                </button>
              ))}
            </div>
          </section>
        ) : null}
        {mode === "hotseat" ? (
          <section className="flex flex-1 flex-col justify-center">
            <h2 className="font-display text-4xl tracking-wide text-fg">Two scrapers</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted sm:text-base">On a phone the pit stands up: bottom is you, top is P2. Drag each half. First to five. No chips leave the vault.</p>
          </section>
        ) : (
          <section>
            <p className="mb-2 font-mono text-xs tracking-[0.22em] text-muted uppercase">Stake</p>
            <div className="grid grid-cols-5 gap-2">
              {STAKES.map((n) => {
                const locked = n > bankroll;
                return (
                  <button key={n} type="button" disabled={locked} onClick={() => setStake(n)} className={cn("h-12 rounded-md font-mono text-sm tabular-nums transition-colors duration-150", n === stake ? "bg-accent text-accent-fg" : "bg-raised text-fg shadow-[var(--shadow-border)]", locked && "cursor-not-allowed opacity-40")}>
                    {n}
                  </button>
                );
              })}
            </div>
            {affordable.length === 0 ? (
              <p className="mt-3 text-sm text-danger">Vault is dry. {live ? "Buy more $ROACH." : "Dumpster dive from the door."}</p>
            ) : (
              <p className="mt-3 font-mono text-sm tabular-nums text-muted">Win pays {formatChips(payout)} {live ? "ROACH" : "paper ROACH"}</p>
            )}
          </section>
        )}
        <div className="gunk-dock sticky bottom-0 z-10 mt-auto pt-3">
          {affordable.length === 0 && mode !== "hotseat" && live ? (
            <Button size="lg" className="w-full" onClick={() => setScreen("buy")}>Buy $ROACH</Button>
          ) : (
            <Button size="lg" className="w-full" disabled={!canDrop} onClick={drop}>{mode === "hotseat" ? "Put the glass down" : "Drop chips"}</Button>
          )}
        </div>
      </div>
    </ScreenFrame>
  );
}

export function ResultScreen() {
  const result = useGunk((s) => s.lastResult);
  const setScreen = useGunk((s) => s.setScreen);
  const startMatch = useGunk((s) => s.startMatch);
  const setStake = useGunk((s) => s.setStake);
  const bankroll = useGunk((s) => s.bankroll);
  const stake = useGunk((s) => s.stake);
  const mode = useGunk((s) => s.mode);
  const live = useGunk((s) => s.live);
  const dumpsterDive = useGunk((s) => s.dumpsterDive);
  const broke = bankroll < BROKE_LINE;
  useEffect(() => {
    if (!result || result.mode === "hotseat") return;
    if (result.won) sfxWin(); else sfxLose();
  }, [result]);
  if (!result) {
    return (<ScreenFrame><div className="flex flex-1 items-center justify-center"><Button onClick={() => setScreen("title")}>Back to the door</Button></div></ScreenFrame>);
  }
  const headline = result.forfeited ? "FOLDED" : result.mode === "rally" ? (result.won ? "QUOTA" : "SPLAT") : (result.won ? "CLEAN" : "GUNKED");
  function rematch() {
    unlockAudio();
    if (mode === "hotseat" || stake <= bankroll) { startMatch(); return; }
    const next = [...STAKES].reverse().find((n) => n <= bankroll);
    if (!next) return;
    setStake(next); startMatch();
  }
  const canRematch = mode === "hotseat" || bankroll >= (STAKES[0] ?? 25);
  return (
    <ScreenFrame>
      <header className="relative z-10 flex items-center justify-between gap-2 pt-1">
        <VaultChip />
        <div className="flex items-center gap-1"><WalletButton /><MuteButton /></div>
      </header>
      <div className="gunk-stagger relative z-10 flex flex-1 flex-col justify-center py-5">
        <p className="font-mono text-xs tracking-[0.22em] text-muted uppercase">{result.label}</p>
        <h2 className="mt-2 font-display text-6xl tracking-wide text-fg">{headline}</h2>
        {result.mode !== "hotseat" ? (
          <p className={cn("mt-4 font-mono text-2xl tabular-nums", result.delta >= 0 ? "text-accent" : "text-danger")}>
            {result.delta >= 0 ? "+" : ""}{formatChips(result.delta)} ROACH
          </p>
        ) : (
          <p className="mt-4 text-base text-muted">Honor table. Vault untouched.</p>
        )}
        <p className="mt-3 font-mono text-sm tabular-nums text-muted">
          {result.mode === "rally" ? `${result.hits} hits` : `${result.you} \u2014 ${result.them} \u00b7 ${result.hits} hits`}
        </p>
      </div>
      <div className="gunk-dock relative z-10 flex flex-col gap-3 pb-2">
        {broke && !live ? <Button size="lg" variant="muted" className="w-full" onClick={() => dumpsterDive()}>Dumpster dive \u00b7 +{DUMPSTER_DIVE}</Button> : null}
        {broke && live ? <Button size="lg" variant="muted" className="w-full" onClick={() => setScreen("buy")}>Buy $ROACH</Button> : null}
        <Button size="lg" className="w-full" disabled={!canRematch} onClick={rematch}>Same table</Button>
        <Button size="lg" variant="ghost" className="w-full" onClick={() => setScreen("mode")}>Change table</Button>
      </div>
    </ScreenFrame>
  );
}

export function RulesScreen() {
  const setScreen = useGunk((s) => s.setScreen);
  const opponent = opponentById("mutant");
  const rally = rallyById("toxic");
  return (
    <ScreenFrame>
      <header className="relative z-10 flex items-center justify-between pt-1">
        <Button variant="ghost" size="icon" aria-label="Back" onClick={() => setScreen("title")}><ChevronLeft /></Button>
        <MuteButton />
      </header>
      <article className="relative z-10 flex-1 space-y-6 overflow-y-auto py-5">
        <h2 className="font-display text-4xl tracking-wide text-fg">House rules</h2>
        <section><h3 className="mb-2 text-sm font-medium text-fg">The smear</h3><p className="text-sm leading-relaxed text-muted">Keep the gunk blob on your side of the glass. First to five takes the pit. Aim with the edge of the scraper to slice \u2014 swipe through the blob for english. Hold still to charge a smash, then cut. The blob stretches, drips, and speeds up as the rally lives. On a phone the pit stands up: you scrape the bottom.</p></section>
        <section><h3 className="mb-2 text-sm font-medium text-fg">Live $ROACH</h3><p className="text-sm leading-relaxed text-muted">Connect StarKey on Supra Mainnet and buy $ROACH on the Atmos Token Studio curve. Buys land in the vault. Table slips still settle in the arcade \u2014 the house does not sweep the chain. Paper chips stay for when the wallet is out of reach.</p></section>
        <section><h3 className="mb-2 text-sm font-medium text-fg">The pit</h3><p className="text-sm leading-relaxed text-muted">Same loop a live Cockroach table would use: stake, play, settle. Odds already bake the house cut. Mutant pays {formatOdds(opponent.odds)}. Toxic rally pays {formatOdds(rally.odds)} if you last {rally.hits} hits.</p></section>
        <section><h3 className="mb-2 text-sm font-medium text-fg">Controls</h3><p className="text-sm leading-relaxed text-muted">Drag the glass. Edges cut the smear; a swipe adds english. On a phone, drag left and right. On a desk, W/S or arrows. Gamepad stick works. Pause with the button, or P / Escape. Folding a live slip burns the stake.</p></section>
        <section><h3 className="mb-2 text-sm font-medium text-fg">Broke</h3><p className="text-sm leading-relaxed text-muted">Paper vault under {BROKE_LINE} chips gets a dumpster for {DUMPSTER_DIVE} more. Live vault buys more $ROACH on Atmos. Roaches eat scraps.</p></section>
      </article>
    </ScreenFrame>
  );
}
