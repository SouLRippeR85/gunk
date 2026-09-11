export type GameMode = "pit" | "rally" | "hotseat";

export type Opponent = {
  id: string;
  name: string;
  tag: string;
  blurb: string;
  odds: number;
  speed: number;
  error: number;
  react: number;
  predict: number;
  paddleH: number;
};

export const OPPONENTS: Opponent[] = [
  { id: "scavenger", name: "Scavenger", tag: "Easy", blurb: "Eats scraps. Misses often.", odds: 1.65, speed: 220, error: 62, react: 0.2, predict: 0, paddleH: 98 },
  { id: "street", name: "Street Rat", tag: "Medium", blurb: "Alley rules. Fair fight.", odds: 2.1, speed: 340, error: 28, react: 0.11, predict: 0.4, paddleH: 90 },
  { id: "king", name: "King Roach", tag: "Hard", blurb: "Survives the drop.", odds: 3.4, speed: 470, error: 12, react: 0.055, predict: 0.78, paddleH: 84 },
  { id: "mutant", name: "Mutant", tag: "Insane", blurb: "Doesn't die. Doesn't miss.", odds: 6, speed: 560, error: 4, react: 0.03, predict: 1, paddleH: 76 },
];

export type RallyTable = { id: string; name: string; blurb: string; hits: number; odds: number };

export const RALLY_TABLES: RallyTable[] = [
  { id: "slick", name: "Slick", blurb: "Warm-up quota.", hits: 12, odds: 1.8 },
  { id: "thick", name: "Thick", blurb: "The blob gets mean.", hits: 20, odds: 3.0 },
  { id: "toxic", name: "Toxic", blurb: "Only the resilient cash.", hits: 32, odds: 5.5 },
];

export const STAKES = [25, 50, 100, 250, 500] as const;
export const STARTING_BANKROLL = 1000;
export const POINTS_TO_WIN = 5;
export const DUMPSTER_DIVE = 250;
export const BROKE_LINE = 25;
export const SAVE_VERSION = 2;
export const SAVE_KEY = "gunk.v1";

export type Stats = { played: number; won: number; lost: number; biggestWin: number; totalWagered: number };
export type HistoryEntry = { t: number; won: boolean; delta: number; label: string; mode: GameMode };
export type SaveData = { version: number; bankroll: number; stats: Stats; history: HistoryEntry[]; muted: boolean; shake: boolean; pendingStake: number };

export const DEFAULT_SAVE: SaveData = {
  version: SAVE_VERSION,
  bankroll: STARTING_BANKROLL,
  stats: { played: 0, won: 0, lost: 0, biggestWin: 0, totalWagered: 0 },
  history: [],
  muted: false,
  shake: true,
  pendingStake: 0,
};

export type MatchResult = { won: boolean; forfeited?: boolean; you: number; them: number; hits: number; stake: number; odds: number; payout: number; delta: number; label: string; mode: GameMode };
export type HudState = { you: number; them: number; hits: number; charge: number; serving: boolean; smash: number; rallyTarget: number; message: string };

export function formatChips(n: number): string {
  const rounded = Math.round(n);
  const sign = rounded < 0 ? "\u2212" : "";
  return `${sign}${Math.abs(rounded).toLocaleString("en-US")}`;
}
export function formatOdds(n: number): string {
  return `${n.toFixed(2).replace(/\.?0+$/, "")}\u00d7`;
}
export function opponentById(id: string): Opponent {
  return OPPONENTS.find((o) => o.id === id) ?? OPPONENTS[0]!;
}
export function rallyById(id: string): RallyTable {
  return RALLY_TABLES.find((t) => t.id === id) ?? RALLY_TABLES[0]!;
}
export function tableLabel(mode: GameMode, opponentId: string, rallyId: string): string {
  if (mode === "pit") return `Pit \u00b7 ${opponentById(opponentId).name}`;
  if (mode === "rally") return `Rally \u00b7 ${rallyById(rallyId).name}`;
  return "Hotseat";
}
export function settlePayout(mode: GameMode, won: boolean, stake: number, odds: number): { payout: number; delta: number } {
  if (mode === "hotseat") return { payout: 0, delta: 0 };
  if (!won) return { payout: 0, delta: -stake };
  const payout = Math.round(stake * odds);
  return { payout, delta: payout - stake };
}
