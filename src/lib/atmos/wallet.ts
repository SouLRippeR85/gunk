import { ATMOS_MODULE, ATMOS_PKG, INTEGRATOR, PLACEHOLDER_TYPE, SUPRA_MAINNET_CHAIN, TX_EXPIRY_SECS } from "./config";
import { addrBytes, bcsBool, bcsU64, moduleAddrNo0x, normalizeAddr } from "./bcs";

export type StarkeySupra = {
  connect: () => Promise<string[] | unknown>;
  account: () => Promise<string[] | unknown>;
  getChainId: () => Promise<unknown>;
  changeNetwork: (n: { chainId: string }) => Promise<unknown>;
  createRawTransactionData: (payload: unknown) => Promise<unknown>;
  sendTransaction: (params: { data: unknown }) => Promise<unknown>;
  disconnect?: () => Promise<unknown>;
  on?: (ev: string, cb: (...args: unknown[]) => void) => void;
};

declare global {
  interface Window { starkey?: { supra?: StarkeySupra } }
}

export function inIframe(): boolean {
  if (typeof window === "undefined") return false;
  try { return window.self !== window.top; } catch { return true; }
}
export function getProvider(): StarkeySupra | null {
  if (typeof window === "undefined") return null;
  return window.starkey?.supra ?? null;
}
export async function waitForProvider(ms = 5000): Promise<StarkeySupra | null> {
  const existing = getProvider();
  if (existing) return existing;
  if (typeof window === "undefined") return null;
  const start = Date.now();
  return new Promise((resolve) => {
    const id = window.setInterval(() => {
      const p = getProvider();
      if (p) { window.clearInterval(id); resolve(p); }
      else if (Date.now() - start >= ms) { window.clearInterval(id); resolve(null); }
    }, 400);
  });
}
export function parseChainId(data: unknown): string {
  if (typeof data === "string" || typeof data === "number") return String(data);
  if (data && typeof data === "object" && "chainId" in data) return String((data as { chainId: unknown }).chainId);
  return "";
}
export function asAccounts(data: unknown): string[] {
  if (Array.isArray(data)) return data.map((x) => String(x)).filter((x) => x.startsWith("0x") || /^[0-9a-fA-F]{64}$/.test(x));
  if (typeof data === "string" && data.startsWith("0x")) return [data];
  if (data && typeof data === "object") {
    const rec = data as { address?: unknown; accounts?: unknown };
    if (typeof rec.address === "string") return [rec.address];
    if (Array.isArray(rec.accounts)) return asAccounts(rec.accounts);
  }
  return [];
}
export function asHash(data: unknown): string {
  if (typeof data === "string" && data.length > 8) return data.startsWith("0x") ? data : `0x${data}`;
  if (data && typeof data === "object") {
    const rec = data as { hash?: unknown; txHash?: unknown; result?: unknown };
    if (typeof rec.hash === "string") return asHash(rec.hash);
    if (typeof rec.txHash === "string") return asHash(rec.txHash);
    if (rec.result) return asHash(rec.result);
  }
  return "";
}
export function walletError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  const lower = msg.toLowerCase();
  if (/reject|denied|cancel|close/i.test(lower)) return "Rejected in StarKey.";
  if (/not found|undefined|inject/i.test(lower)) return "StarKey is not available in this window.";
  return msg.slice(0, 180) || "Wallet error.";
}
export async function ensureMainnet(provider: StarkeySupra): Promise<string> {
  const current = parseChainId(await provider.getChainId());
  if (current === SUPRA_MAINNET_CHAIN) return current;
  await provider.changeNetwork({ chainId: SUPRA_MAINNET_CHAIN });
  return parseChainId(await provider.getChainId()) || SUPRA_MAINNET_CHAIN;
}
export async function sendPumpBuy(args: {
  provider: StarkeySupra; sender: string; pool: string; supraInWithFee: bigint; minTokensOut: bigint;
}): Promise<string> {
  const sender = normalizeAddr(args.sender);
  const rawTxPayload = [
    sender, 0, moduleAddrNo0x(ATMOS_PKG), ATMOS_MODULE, "buy", [PLACEHOLDER_TYPE],
    [addrBytes(args.pool), bcsU64(args.supraInWithFee), bcsU64(args.minTokensOut), bcsBool(false), addrBytes(INTEGRATOR)],
    { txExpiryTime: Math.ceil(Date.now() / 1000) + TX_EXPIRY_SECS },
  ];
  const data = await args.provider.createRawTransactionData(rawTxPayload);
  if (!data) throw new Error("StarKey did not build the buy.");
  const hash = asHash(await args.provider.sendTransaction({ data }));
  if (!hash) throw new Error("No transaction hash from StarKey.");
  return hash;
}
