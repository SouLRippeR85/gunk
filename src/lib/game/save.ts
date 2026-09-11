import { DEFAULT_SAVE, SAVE_KEY, SAVE_VERSION, type SaveData, type Stats } from "./types";

function migrate(raw: SaveData): SaveData {
  const s: SaveData = { ...DEFAULT_SAVE, ...raw, stats: { ...DEFAULT_SAVE.stats, ...raw.stats } };
  if (s.version < SAVE_VERSION) s.version = SAVE_VERSION;
  if (!Array.isArray(s.history)) s.history = [];
  s.history = s.history.slice(0, 12);
  if (!Number.isFinite(s.bankroll)) s.bankroll = DEFAULT_SAVE.bankroll;
  if (!Number.isFinite(s.pendingStake) || s.pendingStake < 0) s.pendingStake = 0;
  return s;
}

export function loadSave(): SaveData {
  if (typeof window === "undefined") return structuredClone(DEFAULT_SAVE);
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return structuredClone(DEFAULT_SAVE);
    const parsed = JSON.parse(raw) as SaveData;
    return migrate(parsed);
  } catch {
    return structuredClone(DEFAULT_SAVE);
  }
}

export function writeSave(data: SaveData): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    /* private mode / quota */
  }
}

export function emptyStats(): Stats {
  return { played: 0, won: 0, lost: 0, biggestWin: 0, totalWagered: 0 };
}
