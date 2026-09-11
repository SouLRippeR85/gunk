import { create } from "zustand";
import { BUY_PRESETS, DEFAULT_TOKEN, SLIPPAGE_BPS, SUPRA_DECIMALS, TOKEN_KEY } from "./config";
import { fromUnits, isAddr, looksLikeRoach, normalizeAddr, tickerOf, toUnits } from "./bcs";
import {
  getFaMeta, getPoolAddress, getSupraBalance, getTokenDetails, getUserBalances,
  getUserTokenBalance, humanToken, simulateBuy, waitForTx, type BuyQuote, type TokenDetails,
} from "./rpc";
import {
  asAccounts, ensureMainnet, getProvider, inIframe, parseChainId, sendPumpBuy,
  waitForProvider, walletError, type StarkeySupra,
} from "./wallet";
import { useGunk } from "@/lib/game/store";

export type QuoteView = { tokensOut: bigint; netSupra: bigint; fee: bigint; minOut: bigint };

type AtmosState = {
  booted: boolean; iframe: boolean; installed: boolean; connecting: boolean; connected: boolean;
  address: string; chainId: string; token: string; pool: string; details: TokenDetails | null;
  decimals: number; ticker: string; completed: boolean; supraRaw: bigint; roachRaw: bigint;
  amount: string; quoting: boolean; quote: QuoteView | null; buying: boolean; status: string; lastTx: string;
  boot: () => void; connect: () => Promise<void>; disconnect: () => void;
  setToken: (raw: string) => Promise<void>; setAmount: (n: string) => void;
  refresh: () => Promise<void>; pullChain: () => void; buy: () => Promise<void>;
};

let unsub: (() => void) | null = null;
let quoteTimer = 0;

function loadSavedToken(): string {
  if (typeof window === "undefined") return "";
  try {
    const q = new URLSearchParams(window.location.search).get("token");
    if (q && isAddr(q)) return normalizeAddr(q);
    const saved = window.localStorage.getItem(TOKEN_KEY);
    if (saved && isAddr(saved)) return normalizeAddr(saved);
    if (DEFAULT_TOKEN && isAddr(DEFAULT_TOKEN)) return normalizeAddr(DEFAULT_TOKEN);
  } catch { /* ignore */ }
  return "";
}
function persistToken(token: string) {
  if (typeof window === "undefined") return;
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch { /* quota */ }
}
function applyLive(chainHuman: number) { useGunk.getState().enterLive(chainHuman); }
function wireProvider(provider: StarkeySupra, onChange: () => void) {
  unsub?.();
  if (!provider.on) { unsub = null; return; }
  provider.on("accountChanged", () => onChange());
  provider.on("networkChanged", () => onChange());
  provider.on("disconnect", () => useAtmos.getState().disconnect());
  unsub = () => { unsub = null; };
}
async function detectRoach(owner: string): Promise<string> {
  const held = await getUserBalances(owner);
  const ranked = [...held].sort((a, b) => (a.raw < b.raw ? 1 : a.raw > b.raw ? -1 : 0)).slice(0, 12);
  const found: string[] = [];
  await Promise.all(ranked.map(async (row) => {
    try {
      const meta = await getFaMeta(row.token);
      if (looksLikeRoach(meta.symbol) || looksLikeRoach(meta.name)) found.push(normalizeAddr(row.token));
    } catch { /* skip */ }
  }));
  return found[0] ?? "";
}
async function resolveMint(token: string) {
  const addr = normalizeAddr(token);
  const [meta, pool] = await Promise.all([getFaMeta(addr), getPoolAddress(addr)]);
  const details = await getTokenDetails(pool);
  return { token: addr, pool, details, decimals: meta.decimals };
}
function scheduleQuote() {
  if (typeof window === "undefined") return;
  window.clearTimeout(quoteTimer);
  quoteTimer = window.setTimeout(() => { void runQuote(); }, 280);
}
async function runQuote() {
  const s = useAtmos.getState();
  if (!s.pool || s.completed) { useAtmos.setState({ quote: null, quoting: false }); return; }
  let raw: bigint;
  try { raw = toUnits(s.amount, SUPRA_DECIMALS); } catch { useAtmos.setState({ quote: null, quoting: false }); return; }
  if (raw <= 0n) { useAtmos.setState({ quote: null, quoting: false }); return; }
  useAtmos.setState({ quoting: true });
  try {
    const q: BuyQuote = await simulateBuy(s.pool, raw);
    const minOut = (q.tokensOut * BigInt(10_000 - SLIPPAGE_BPS)) / 10_000n;
    useAtmos.setState({ quoting: false, quote: { ...q, minOut } });
  } catch (err) {
    useAtmos.setState({ quoting: false, quote: null, status: err instanceof Error ? err.message : "Quote failed." });
  }
}

export const useAtmos = create<AtmosState>((set, get) => ({
  booted: false, iframe: false, installed: false, connecting: false, connected: false,
  address: "", chainId: "", token: "", pool: "", details: null, decimals: 6, ticker: "ROACH",
  completed: false, supraRaw: 0n, roachRaw: 0n, amount: String(BUY_PRESETS[1]), quoting: false,
  quote: null, buying: false, status: "", lastTx: "",
  boot: () => {
    if (get().booted) return;
    const iframe = inIframe();
    const token = loadSavedToken();
    set({ booted: true, iframe, token });
    void (async () => {
      const mintTask = token ? get().setToken(token).catch((err) => {
        set({ status: err instanceof Error ? err.message : "Could not load mint." });
      }) : Promise.resolve();
      const provider = await waitForProvider();
      set({ installed: Boolean(provider) });
      if (provider) {
        wireProvider(provider, () => { void get().refresh(); });
        try {
          const acc = asAccounts(await provider.account());
          if (acc[0]) {
            set({ connected: true, address: normalizeAddr(acc[0]) });
            await mintTask; await get().refresh();
            applyLive(humanToken(get().roachRaw, get().decimals));
            return;
          }
        } catch { /* not connected yet */ }
      }
      await mintTask;
    })();
  },
  connect: async () => {
    set({ connecting: true, status: "" });
    try {
      const provider = (await waitForProvider(2500)) ?? getProvider();
      if (!provider) {
        set({ connecting: false, installed: false, status: get().iframe
          ? "StarKey cannot inject into this nested window. Open GUNK in a new tab."
          : "StarKey is not installed." });
        return;
      }
      set({ installed: true });
      const acc = asAccounts(await provider.connect());
      const address = acc[0] ? normalizeAddr(acc[0]) : "";
      if (!address) throw new Error("No account from StarKey.");
      const chainId = await ensureMainnet(provider);
      wireProvider(provider, () => { void get().refresh(); });
      set({ connecting: false, connected: true, address, chainId });
      await get().refresh();
      applyLive(humanToken(get().roachRaw, get().decimals));
    } catch (err) { set({ connecting: false, status: walletError(err) }); }
  },
  disconnect: () => {
    unsub?.();
    useGunk.getState().exitLive();
    set({ connected: false, address: "", chainId: "", supraRaw: 0n, roachRaw: 0n, connecting: false, status: "" });
    void getProvider()?.disconnect?.();
  },
  setToken: async (raw) => {
    const trimmed = raw.trim();
    if (!isAddr(trimmed)) { set({ status: "Paste a full token address." }); return; }
    set({ status: "Reading mint\u2026" });
    try {
      const resolved = await resolveMint(trimmed);
      persistToken(resolved.token);
      set({
        token: resolved.token, pool: resolved.pool, details: resolved.details,
        decimals: resolved.decimals, ticker: tickerOf(resolved.details.symbol),
        completed: resolved.details.completed,
        status: resolved.details.completed ? "Curve closed \u2014 this mint graduated off the pump." : "",
      });
      scheduleQuote();
      const address = get().address;
      if (address) {
        try {
          const [supraRaw, roachRaw] = await Promise.all([
            getSupraBalance(address), getUserTokenBalance(address, resolved.token),
          ]);
          set({ supraRaw, roachRaw });
        } catch { /* quote still works */ }
      }
    } catch (err) { set({ status: err instanceof Error ? err.message : "Could not resolve mint." }); }
  },
  setAmount: (n) => { set({ amount: n }); scheduleQuote(); },
  refresh: async () => {
    const s = get();
    const provider = getProvider();
    if (provider && s.connected) {
      try {
        const acc = asAccounts(await provider.account());
        const address = acc[0] ? normalizeAddr(acc[0]) : s.address;
        const chainId = parseChainId(await provider.getChainId());
        set({ address, chainId });
      } catch { /* keep */ }
    }
    const address = get().address;
    let token = get().token;
    if (address && !token) {
      try { const found = await detectRoach(address); if (found) token = found; } catch { /* leave empty */ }
    }
    if (token && (token !== get().token || !get().pool)) {
      try {
        const resolved = await resolveMint(token);
        persistToken(resolved.token);
        set({
          token: resolved.token, pool: resolved.pool, details: resolved.details,
          decimals: resolved.decimals, ticker: tickerOf(resolved.details.symbol),
          completed: resolved.details.completed,
          status: resolved.details.completed ? "Curve closed \u2014 this mint graduated off the pump." : get().status,
        });
        token = resolved.token;
      } catch (err) { set({ status: err instanceof Error ? err.message : "Could not resolve mint." }); }
    }
    token = get().token;
    if (!address) return;
    try {
      const supraRaw = await getSupraBalance(address);
      let roachRaw = 0n;
      if (token) { try { roachRaw = await getUserTokenBalance(address, token); } catch { roachRaw = 0n; } }
      set({ supraRaw, roachRaw });
      scheduleQuote();
    } catch (err) { set({ status: err instanceof Error ? err.message : "Could not read balances." }); }
  },
  pullChain: () => {
    const s = get();
    useGunk.getState().pullChain(humanToken(s.roachRaw, s.decimals));
  },
  buy: async () => {
    const s = get();
    if (s.buying) return;
    const provider = getProvider();
    if (!provider || !s.connected || !s.address) { await get().connect(); return; }
    if (!s.pool || !s.token) { set({ status: "Paste the $ROACH mint first." }); return; }
    if (s.completed) { set({ status: "Curve closed \u2014 this mint graduated off the pump." }); return; }
    let raw: bigint;
    try { raw = toUnits(s.amount, SUPRA_DECIMALS); }
    catch (err) { set({ status: err instanceof Error ? err.message : "Enter an amount." }); return; }
    if (raw <= 0n) { set({ status: "Enter an amount." }); return; }
    if (raw > s.supraRaw) { set({ status: "Not enough SUPRA in StarKey." }); return; }
    set({ buying: true, status: "Quoting\u2026" });
    try {
      await ensureMainnet(provider);
      const q = await simulateBuy(s.pool, raw);
      const minOut = (q.tokensOut * BigInt(10_000 - SLIPPAGE_BPS)) / 10_000n;
      if (minOut <= 0n) throw new Error("Quote is dust. Raise the clip.");
      set({ quote: { ...q, minOut }, status: "Confirm the buy in StarKey\u2026" });
      const before = s.roachRaw;
      const hash = await sendPumpBuy({ provider, sender: s.address, pool: s.pool, supraInWithFee: raw, minTokensOut: minOut });
      set({ lastTx: hash, status: "Waiting for the smear to land\u2026" });
      await waitForTx(hash);
      await get().refresh();
      const after = get().roachRaw;
      const gainedRaw = after > before ? after - before : q.tokensOut;
      const gained = Math.max(1, Math.floor(fromUnits(gainedRaw, get().decimals)));
      useGunk.getState().credit(gained);
      set({ buying: false, status: `Landed +${gained.toLocaleString("en-US")} ${get().ticker}.` });
    } catch (err) { set({ buying: false, status: walletError(err) }); }
  },
}));
