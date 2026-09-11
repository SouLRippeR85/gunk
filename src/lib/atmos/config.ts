export const ATMOS_PKG =
  "0xa4a4a31116e114bf3c4f4728914e6b43db73279a4421b0768993e07248fe2234";
export const ATMOS_MODULE = "atmos_pump";
export const PLACEHOLDER_TYPE = `${ATMOS_PKG}::${ATMOS_MODULE}::PLACEHOLDER`;

export const RPC_VIEW = "https://rpc-mainnet.supra.com/rpc/v1/view";
export const RPC_TX = "https://rpc-mainnet.supra.com/rpc/v1/transactions";
export const RPC_ACCOUNT_V2 = "https://rpc-mainnet.supra.com/rpc/v2/accounts";

export const SUPRA_MAINNET_CHAIN = "8";
export const SUPRA_DECIMALS = 8;
export const DEFAULT_TOKEN_DECIMALS = 6;

export const INTEGRATOR =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

export const SLIPPAGE_BPS = 500;
export const BUY_PRESETS = [1, 5, 10, 25, 50] as const;
export const TX_EXPIRY_SECS = 60;

export const TOKEN_KEY = "gunk.atmos.mint";
/** CockARoach Survivalist ($ROACH) on Atmos Token Studio. Override with ?token=. */
export const DEFAULT_TOKEN =
  "0x868158dfec060b9976693ce4bfd6fefd4fd44c8b965a41b0b29e848c5c280532";
export const STARKEY_URL = "https://starkey.app";
export const ATMOS_APP_URL = "https://app.atmos.ag/";
export const SUPRASCAN_TX = "https://suprascan.io/tx";

export const ZERO_ADDR = INTEGRATOR;
