export function strip0x(hex: string): string {
  return hex.startsWith("0x") || hex.startsWith("0X") ? hex.slice(2) : hex;
}
export function normalizeAddr(hex: string): string {
  const h = strip0x(hex).toLowerCase();
  if (!h || h.length > 64 || /[^0-9a-f]/.test(h)) throw new Error("Not a Supra address.");
  return `0x${h.padStart(64, "0")}`;
}
export function isAddr(hex: string): boolean {
  const h = strip0x(hex.trim());
  return h.length > 0 && h.length <= 64 && /^[0-9a-fA-F]+$/.test(h);
}
export function addrBytes(hex: string): Uint8Array {
  const h = strip0x(normalizeAddr(hex));
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++) out[i] = Number.parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return out;
}
export function moduleAddrNo0x(hex: string): string { return strip0x(normalizeAddr(hex)); }
export function bcsU64(n: bigint): Uint8Array {
  if (n < 0n || n > 0xffff_ffff_ffff_ffffn) throw new Error("Amount out of range.");
  const out = new Uint8Array(8); let x = n;
  for (let i = 0; i < 8; i++) { out[i] = Number(x & 0xffn); x >>= 8n; }
  return out;
}
export function bcsBool(v: boolean): Uint8Array { return new Uint8Array([v ? 1 : 0]); }
export function toUnits(human: string, decimals: number): bigint {
  const t = human.trim();
  if (!t || !/^\d+(\.\d+)?$/.test(t)) throw new Error("Enter an amount.");
  const [w, f = ""] = t.split(".");
  if (f.length > decimals) throw new Error("Too many decimals.");
  const frac = f.padEnd(decimals, "0");
  const raw = `${w}${frac}`.replace(/^0+(?=\d)/, "");
  return BigInt(raw || "0");
}
export function fromUnits(raw: bigint, decimals: number): number {
  const neg = raw < 0n; const x = neg ? -raw : raw;
  const base = 10n ** BigInt(decimals);
  const n = Number(x / base) + Number(x % base) / Number(base);
  return neg ? -n : n;
}
export function shortAddr(addr: string): string {
  const a = normalizeAddr(addr); return `${a.slice(0, 6)}\u2026${a.slice(-4)}`;
}
export function tickerOf(symbol: string | undefined): string {
  const s = (symbol ?? "ROACH").replace(/^\$/, "").trim(); return s || "ROACH";
}
export function looksLikeRoach(symbol: string): boolean {
  const s = symbol.replace(/^\$/, "").trim().toUpperCase(); return s === "ROACH" || s === "GUNK";
}
