import type { ReactNode } from "react";
import { Volume2, VolumeX, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { tickerOf } from "@/lib/atmos/bcs";
import { useAtmos } from "@/lib/atmos/store";
import { unlockAudio } from "@/lib/game/audio";
import { useGunk } from "@/lib/game/store";
import { formatChips } from "@/lib/game/types";
import { cn } from "@/lib/utils";

export function ChipIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="9.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.4 5.4l1.7 1.7M16.9 16.9l1.7 1.7M5.4 18.6l1.7-1.7M16.9 7.1l1.7-1.7"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function VaultChip({ className }: { className?: string }) {
  const bankroll = useGunk((s) => s.bankroll);
  const live = useGunk((s) => s.live);
  const screen = useGunk((s) => s.screen);
  const setScreen = useGunk((s) => s.setScreen);
  const ticker = useAtmos((s) => s.ticker);
  const label = tickerOf(ticker);
  const clickable = screen !== "play" && screen !== "buy";
  const body = (
    <>
      <ChipIcon className="size-4 shrink-0 text-accent" />
      <span className="min-w-0 truncate">{formatChips(bankroll)}</span>
      <span className="hidden text-muted sm:inline">{label}</span>
      <span className={`shrink-0 font-mono text-xs tracking-[0.14em] uppercase ${live ? "text-accent" : "text-faint"}`}>
        {live ? "Live" : "Paper"}
      </span>
    </>
  );
  const box = cn(
    "inline-flex h-11 max-w-full min-w-0 items-center gap-2 rounded-md bg-raised px-3 font-mono text-sm tabular-nums text-fg shadow-[var(--shadow-border)]",
    clickable && "transition-shadow duration-150 hover:shadow-[var(--shadow-border-hover)]",
    className,
  );
  if (clickable) {
    return (
      <button type="button" className={box} aria-label={`${formatChips(bankroll)} ${live ? "live" : "paper"} ${label}. Open buy.`} onClick={() => setScreen("buy")}>
        {body}
      </button>
    );
  }
  return <div className={box} aria-label={`${formatChips(bankroll)} ${live ? "live" : "paper"} ${label}`}>{body}</div>;
}

export function WalletButton() {
  const connected = useAtmos((s) => s.connected);
  const connecting = useAtmos((s) => s.connecting);
  const connect = useAtmos((s) => s.connect);
  const setScreen = useGunk((s) => s.setScreen);
  return (
    <Button variant="ghost" size="icon" aria-label={connected ? "Open live buy" : "Connect StarKey"} disabled={connecting} onClick={() => { unlockAudio(); setScreen("buy"); if (!connected) void connect(); }}>
      <Wallet />
    </Button>
  );
}

export function MuteButton() {
  const muted = useGunk((s) => s.muted);
  const toggleMuted = useGunk((s) => s.toggleMuted);
  return (
    <Button variant="ghost" size="icon" aria-label={muted ? "Unmute" : "Mute"} onClick={() => { unlockAudio(); toggleMuted(); }}>
      {muted ? <VolumeX /> : <Volume2 />}
    </Button>
  );
}

export function Drips() {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 h-36 overflow-hidden" aria-hidden="true">
      <span className="gunk-drip gunk-drip-1 absolute top-0 w-1 rounded-full bg-accent/70" />
      <span className="gunk-drip gunk-drip-2 absolute top-0 w-1 rounded-full bg-accent/55" />
      <span className="gunk-drip gunk-drip-3 absolute top-0 w-1 rounded-full bg-accent/80" />
      <span className="gunk-drip gunk-drip-4 absolute top-0 w-1 rounded-full bg-accent/45" />
    </div>
  );
}

export function ScreenFrame({ children }: { children: ReactNode }) {
  return (
    <main className="gunk-safe relative mx-auto flex h-dvh w-full max-w-lg flex-col overflow-x-hidden overflow-y-auto px-4">
      <Drips />
      {children}
    </main>
  );
}

export function TopBar({ left, right }: { left?: ReactNode; right?: ReactNode }) {
  return (
    <header className="relative z-10 flex items-center gap-2 pt-1">
      <div className="flex w-11 shrink-0 justify-start">{left}</div>
      <div className="flex min-w-0 flex-1 justify-center"><VaultChip /></div>
      <div className="flex w-11 shrink-0 justify-end">{right ?? <MuteButton />}</div>
    </header>
  );
}

export function Panel({ children, className, active }: { children: ReactNode; className?: string; active?: boolean }) {
  return (
    <div className={cn("rounded-xl bg-surface p-3 text-left shadow-[var(--shadow-border)] transition-shadow duration-150 ease-out", active && "shadow-[var(--shadow-border-hover)]", className)}>
      {children}
    </div>
  );
}
