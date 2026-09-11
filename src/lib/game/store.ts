import { create } from "zustand";
import { loadSave, writeSave } from "./save";
import {
  BROKE_LINE, DUMPSTER_DIVE, DEFAULT_SAVE, opponentById, rallyById,
  type GameMode, type HistoryEntry, type MatchResult, type SaveData, type Stats,
} from "./types";

export type Screen = "title" | "mode" | "wager" | "play" | "result" | "rules" | "buy";

type GunkStore = SaveData & {
  hydrated: boolean; live: boolean; screen: Screen; mode: GameMode;
  opponentId: string; rallyId: string; stake: number; lastResult: MatchResult | null;
  hydrate: () => void; persist: () => void; setScreen: (screen: Screen) => void;
  setMode: (mode: GameMode) => void; setOpponent: (id: string) => void; setRally: (id: string) => void;
  setStake: (n: number) => void; toggleMuted: () => void; toggleShake: () => void;
  startMatch: () => boolean; settle: (result: MatchResult) => void; dumpsterDive: () => boolean;
  enterLive: (chainHuman: number) => void; exitLive: () => void; credit: (n: number) => void;
  pullChain: (chainHuman: number) => void; currentOdds: () => number;
};

function persistable(s: GunkStore): SaveData {
  return { version: s.version, bankroll: s.bankroll, stats: s.stats, history: s.history, muted: s.muted, shake: s.shake, pendingStake: s.pendingStake };
}

export const useGunk = create<GunkStore>((set, get) => ({
  ...structuredClone(DEFAULT_SAVE),
  hydrated: false, live: false, screen: "title", mode: "pit",
  opponentId: "scavenger", rallyId: "slick", stake: 50, lastResult: null,
  hydrate: () => {
    if (get().hydrated) return;
    const loaded = loadSave();
    if (loaded.pendingStake > 0) { loaded.bankroll += loaded.pendingStake; loaded.pendingStake = 0; }
    set({ ...loaded, hydrated: true }); get().persist();
  },
  persist: () => writeSave(persistable(get())),
  setScreen: (screen) => set({ screen }),
  setMode: (mode) => set({ mode }),
  setOpponent: (opponentId) => set({ opponentId }),
  setRally: (rallyId) => set({ rallyId }),
  setStake: (stake) => set({ stake }),
  toggleMuted: () => { set({ muted: !get().muted }); get().persist(); },
  toggleShake: () => { set({ shake: !get().shake }); get().persist(); },
  currentOdds: () => {
    const s = get();
    if (s.mode === "rally") return rallyById(s.rallyId).odds;
    if (s.mode === "hotseat") return 1;
    return opponentById(s.opponentId).odds;
  },
  startMatch: () => {
    const s = get();
    if (s.mode === "hotseat") { set({ screen: "play" }); return true; }
    if (s.stake > s.bankroll || s.stake <= 0) return false;
    set({ bankroll: s.bankroll - s.stake, pendingStake: s.stake, screen: "play" });
    get().persist(); return true;
  },
  settle: (result) => {
    const s = get();
    const stats: Stats = { ...s.stats };
    stats.played += 1;
    if (result.mode !== "hotseat") stats.totalWagered += result.stake;
    if (result.won) { stats.won += 1; stats.biggestWin = Math.max(stats.biggestWin, result.delta); }
    else stats.lost += 1;
    const entry: HistoryEntry = { t: Date.now(), won: result.won, delta: result.delta, label: result.label, mode: result.mode };
    set({ bankroll: s.bankroll + result.payout, pendingStake: 0, stats, history: [entry, ...s.history].slice(0, 12), lastResult: result, screen: "result" });
    get().persist();
  },
  dumpsterDive: () => {
    const s = get();
    if (s.live || s.bankroll >= BROKE_LINE) return false;
    set({ bankroll: s.bankroll + DUMPSTER_DIVE }); get().persist(); return true;
  },
  enterLive: (chainHuman) => {
    const s = get();
    set({ live: true, bankroll: Math.max(s.bankroll, Math.max(0, Math.floor(chainHuman))) }); get().persist();
  },
  exitLive: () => { set({ live: false }); get().persist(); },
  credit: (n) => { const add = Math.floor(n); if (add <= 0) return; set({ bankroll: get().bankroll + add }); get().persist(); },
  pullChain: (chainHuman) => { set({ bankroll: Math.max(0, Math.floor(chainHuman)), live: true }); get().persist(); },
}));
