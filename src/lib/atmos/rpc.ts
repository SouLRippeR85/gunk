import {
  ATMOS_PKG,
  DEFAULT_TOKEN_DECIMALS,
  RPC_ACCOUNT_V2,
  RPC_TX,
  RPC_VIEW,
  SUPRA_DECIMALS,
} from "./config";
import { fromUnits, normalizeAddr } from "./bcs";

type ViewBody = {
  function: string;
  type_arguments: string[];
  arguments: unknown[];
};

export type TokenDetails = {
  tokenAddress: string;
  name: string;
  symbol: string;
  price: bigint;
  completed: boolean;
  crowned: boolean;
  holders: number;
};

export type BuyQuote = {
  tokensOut: bigint;
  netSupra: bigint;
  fee: bigint;
};

export type FaMeta = {
  name: string;
  symbol: string;
  decimals: number;
};

function asErrorMessage(body: string): string {
  if (/sub status 107/i.test(body) || /POOL_COMPLETED/i.test(body)) {
    return "Curve closed \u2014 this mint graduated off the pump.";
  }
  if (/sub status 115/i.test(body) || /POOL_NOT_FOUND/i.test(body)) {
    return "No Atmos pump pool for this mint.";
  }
  if (/INSUFFICIENT/i.test(body)) return "Not enough SUPRA in the wallet.";
  if (/MIN_OUT/i.test(body)) return "Price moved. Raise slippage or try a smaller clip.";
  try {
    const parsed = JSON.parse(body) as { message?: string };
    if (parsed.message) return parsed.message.slice(0, 180);
  } catch {
    /* raw */
  }
  return body.slice(0, 180) || "RPC error.";
}

async function view(fn: string, args: unknown[], typeArgs: string[] = []): Promise<unknown> {
  const body: ViewBody = { function: fn, type_arguments: typeArgs, arguments: args };
  const res = await fetch(RPC_VIEW, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: { result?: unknown; message?: string } = {};
  try {
    json = JSON.parse(text) as { result?: unknown; message?: string };
  } catch {
    throw new Error(asErrorMessage(text));
  }
  if (!res.ok) throw new Error(asErrorMessage(text || json.message || res.statusText));
  return json.result;
}

function first<T>(result: unknown): T {
  if (Array.isArray(result)) return result[0] as T;
  return result as T;
}

export async function getSupraBalance(owner: string): Promise<bigint> {
  const result = await view("0x1::coin::balance", [normalizeAddr(owner)], [
    "0x1::supra_coin::SupraCoin",
  ]);
  return BigInt(String(first(result) ?? "0"));
}

export async function getUserTokenBalance(owner: string, token: string): Promise<bigint> {
  const result = await view(`${ATMOS_PKG}::atmos_pump::get_user_balance`, [
    normalizeAddr(owner),
    normalizeAddr(token),
  ]);
  return BigInt(String(first(result) ?? "0"));
}

export async function getUserBalances(owner: string): Promise<{ token: string; raw: bigint }[]> {
  const result = await view(`${ATMOS_PKG}::atmos_pump::get_user_balances`, [
    normalizeAddr(owner),
  ]);
  const bag = first<{ data?: { key: string; value: string }[] }>(result);
  const rows = bag?.data ?? [];
  return rows.map((row) => ({ token: row.key, raw: BigInt(row.value) }));
}

export async function getPoolAddress(token: string): Promise<string> {
  const result = await view(`${ATMOS_PKG}::atmos_pump::get_pool_address_fa`, [
    normalizeAddr(token),
  ]);
  return normalizeAddr(String(first(result)));
}

type DetailsRaw = {
  token_address?: string;
  name?: string;
  symbol?: string;
  price?: string;
  is_completed?: boolean;
  is_crowned?: boolean;
  holders?: string;
};

export async function getTokenDetails(pool: string): Promise<TokenDetails> {
  const result = await view(`${ATMOS_PKG}::atmos_pump::get_token_details`, [
    normalizeAddr(pool),
  ]);
  const raw = first<DetailsRaw>(result) ?? {};
  return {
    tokenAddress: String(raw.token_address ?? ""),
    name: String(raw.name ?? ""),
    symbol: String(raw.symbol ?? ""),
    price: BigInt(raw.price ?? "0"),
    completed: Boolean(raw.is_completed),
    crowned: Boolean(raw.is_crowned),
    holders: Number(raw.holders ?? 0),
  };
}

export async function simulateBuy(pool: string, supraInWithFee: bigint): Promise<BuyQuote> {
  const result = await view(`${ATMOS_PKG}::atmos_pump::simulate_buy`, [
    normalizeAddr(pool),
    supraInWithFee.toString(),
  ]);
  const row = Array.isArray(result) ? result : [];
  return {
    tokensOut: BigInt(String(row[0] ?? "0")),
    netSupra: BigInt(String(row[1] ?? "0")),
    fee: BigInt(String(row[2] ?? "0")),
  };
}

export async function getFaMeta(token: string): Promise<FaMeta> {
  const res = await fetch(`${RPC_ACCOUNT_V2}/${normalizeAddr(token)}/resources`);
  if (!res.ok) throw new Error("Could not read token metadata.");
  const json = (await res.json()) as {
    resources?: { type: string; data?: { name?: string; symbol?: string; decimals?: number } }[];
  };
  const meta = (json.resources ?? []).find((r) => r.type === "0x1::fungible_asset::Metadata");
  if (!meta?.data) throw new Error("Not a fungible token.");
  return {
    name: String(meta.data.name ?? ""),
    symbol: String(meta.data.symbol ?? ""),
    decimals: Number(meta.data.decimals ?? DEFAULT_TOKEN_DECIMALS),
  };
}

export async function waitForTx(hash: string, timeoutMs = 90_000): Promise<void> {
  const h = hash.startsWith("0x") ? hash : `0x${hash}`;
  const start = Date.now();
  let delay = 800;
  while (Date.now() - start < timeoutMs) {
    const res = await fetch(`${RPC_TX}/${h}`);
    if (res.ok) {
      const json = (await res.json()) as { status?: string };
      const status = String(json.status ?? "");
      if (status === "Success") return;
      if (status && status !== "Pending") {
        throw new Error(`Transaction ${status.toLowerCase()}.`);
      }
    }
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay + 400, 2500);
  }
  throw new Error("Timed out waiting for the buy to land.");
}

export function humanSupra(raw: bigint): number {
  return fromUnits(raw, SUPRA_DECIMALS);
}

export function humanToken(raw: bigint, decimals: number): number {
  return fromUnits(raw, decimals);
}
