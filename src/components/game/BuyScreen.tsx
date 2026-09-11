import { ChevronLeft, Copy, ExternalLink, RefreshCw, Unplug, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { MuteButton, Panel, ScreenFrame } from "@/components/game/ui";
import { Button } from "@/components/ui/button";
import { fromUnits, shortAddr } from "@/lib/atmos/bcs";
import { ATMOS_APP_URL, BUY_PRESETS, SLIPPAGE_BPS, STARKEY_URL, SUPRASCAN_TX } from "@/lib/atmos/config";
import { humanSupra, humanToken } from "@/lib/atmos/rpc";
import { useAtmos } from "@/lib/atmos/store";
import { useGunk } from "@/lib/game/store";
import { formatChips } from "@/lib/game/types";
import { cn } from "@/lib/utils";

export function BuyScreen() {
  const setScreen = useGunk((s) => s.setScreen);
  const live = useGunk((s) => s.live);
  const bankroll = useGunk((s) => s.bankroll);
  const iframe = useAtmos((s) => s.iframe);
  const installed = useAtmos((s) => s.installed);
  const connecting = useAtmos((s) => s.connecting);
  const connected = useAtmos((s) => s.connected);
  const address = useAtmos((s) => s.address);
  const chainId = useAtmos((s) => s.chainId);
  const token = useAtmos((s) => s.token);
  const details = useAtmos((s) => s.details);
  const ticker = useAtmos((s) => s.ticker);
  const completed = useAtmos((s) => s.completed);
  const decimals = useAtmos((s) => s.decimals);
  const supraRaw = useAtmos((s) => s.supraRaw);
  const roachRaw = useAtmos((s) => s.roachRaw);
  const amount = useAtmos((s) => s.amount);
  const quoting = useAtmos((s) => s.quoting);
  const quote = useAtmos((s) => s.quote);
  const buying = useAtmos((s) => s.buying);
  const status = useAtmos((s) => s.status);
  const lastTx = useAtmos((s) => s.lastTx);
  const connect = useAtmos((s) => s.connect);
  const disconnect = useAtmos((s) => s.disconnect);
  const setToken = useAtmos((s) => s.setToken);
  const setAmount = useAtmos((s) => s.setAmount);
  const refresh = useAtmos((s) => s.refresh);
  const pullChain = useAtmos((s) => s.pullChain);
  const buy = useAtmos((s) => s.buy);

  const [mintDraft, setMintDraft] = useState(token);
  const [copied, setCopied] = useState("");
  const [mintOpen, setMintOpen] = useState(!token);

  useEffect(() => {
    setMintDraft(token);
    if (token) setMintOpen(false);
  }, [token]);

  const chainHuman = Math.floor(humanToken(roachRaw, decimals));
  const supraHuman = humanSupra(supraRaw);
  const quoteHuman = quote ? fromUnits(quote.tokensOut, decimals) : 0;
  const wrongNet = connected && chainId && chainId !== "8";
  const canBuy = connected && Boolean(token) && !completed && !buying && !wrongNet;

  function copy(text: string, label: string) {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(label);
      window.setTimeout(() => setCopied(""), 1600);
    });
  }
  function openLoose() {
    const url = window.location.href;
    const w = window.open(url, "_blank", "noopener,noreferrer");
    if (!w) copy(url, "link");
  }

  return (
    <ScreenFrame>
      <header className="relative z-10 flex items-center justify-between pt-1">
        <Button variant="ghost" size="icon" aria-label="Back" onClick={() => setScreen("title")}>
          <ChevronLeft />
        </Button>
        <MuteButton />
      </header>

      <div className="relative z-10 flex flex-1 flex-col gap-4 py-4">
        <div>
          <p className="font-mono text-xs tracking-[0.22em] text-muted uppercase">Atmos pump</p>
          <h2 className="mt-1 font-display text-4xl tracking-wide text-fg">Buy live</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            StarKey signs a curve buy on Atmos. The pit still settles in the arcade \u2014 the house does not sweep your wallet.
          </p>
        </div>

        {iframe ? (
          <Panel>
            <p className="text-sm leading-relaxed text-fg">StarKey cannot see this nested window.</p>
            <p className="mt-1 text-sm leading-relaxed text-muted">Open GUNK in a new tab or the StarKey browser, then connect.</p>
            <div className="mt-3 flex flex-col gap-2">
              <Button size="lg" className="w-full" onClick={openLoose}>Open in a new tab</Button>
              <Button size="md" variant="ghost" className="w-full" onClick={() => copy(window.location.href, "link")}>
                <Copy /> {copied === "link" ? "Copied" : "Copy link"}
              </Button>
            </div>
          </Panel>
        ) : null}

        <Panel>
          <div className="flex items-center justify-between gap-3">
            <p className="font-mono text-xs tracking-[0.22em] text-muted uppercase">Wallet</p>
            {connected ? (
              <span className="font-mono text-xs tracking-[0.18em] text-accent uppercase">Live</span>
            ) : (
              <span className="font-mono text-xs tracking-[0.18em] text-faint uppercase">Paper</span>
            )}
          </div>
          {connected ? (
            <div className="mt-3 space-y-2">
              <p className="font-mono text-sm tabular-nums text-fg">{shortAddr(address)}</p>
              <p className="font-mono text-xs tabular-nums text-muted">
                {supraHuman.toLocaleString("en-US", { maximumFractionDigits: 2 })} SUPRA \u00b7 {formatChips(chainHuman)} on-chain {ticker}
              </p>
              {wrongNet ? <p className="text-sm text-danger">Switch StarKey to Supra Mainnet.</p> : null}
              <div className="flex gap-2 pt-1">
                <Button size="sm" variant="ghost" onClick={() => void refresh()} aria-label="Refresh balances">
                  <RefreshCw /> Refresh
                </Button>
                <Button size="sm" variant="ghost" onClick={() => disconnect()}>
                  <Unplug /> Drop
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              <p className="text-sm leading-relaxed text-muted">
                {installed ? "StarKey is here. Connect to buy on the curve." : "Install StarKey, then come back to this tab."}
              </p>
              {installed ? (
                <Button size="lg" className="w-full" disabled={connecting} onClick={() => void connect()}>
                  <Wallet /> {connecting ? "Connecting\u2026" : "Connect StarKey"}
                </Button>
              ) : (
                <Button size="lg" className="w-full" asChild>
                  <a href={STARKEY_URL} target="_blank" rel="noreferrer">
                    <ExternalLink /> Get StarKey
                  </a>
                </Button>
              )}
            </div>
          )}
        </Panel>

        <Panel>
          <p className="font-mono text-xs tracking-[0.22em] text-muted uppercase">Mint</p>
          {details ? (
            <p className="mt-2 text-sm text-fg">{details.name} \u00b7 {ticker}{completed ? " \u00b7 graduated" : ""}</p>
          ) : (
            <p className="mt-2 text-sm text-muted">Connect StarKey and held $ROACH is picked up. Or paste the Token Studio mint.</p>
          )}
          {token && !mintOpen ? (
            <button type="button" className="mt-3 font-mono text-xs tracking-[0.16em] text-muted uppercase" onClick={() => setMintOpen(true)}>
              Change mint
            </button>
          ) : (
            <form className="mt-3 flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); void setToken(mintDraft); }}>
              <input className="gunk-input" value={mintDraft} onChange={(e) => setMintDraft(e.target.value)} placeholder="0x\u2026" spellCheck={false} autoCapitalize="off" autoCorrect="off" aria-label="Token address" />
              <Button type="submit" variant="muted" size="md" className="w-full">Load mint</Button>
            </form>
          )}
        </Panel>

        <section>
          <p className="mb-2 font-mono text-xs tracking-[0.22em] text-muted uppercase">SUPRA clip</p>
          <div className="grid grid-cols-5 gap-2">
            {BUY_PRESETS.map((n) => (
              <button key={n} type="button" onClick={() => setAmount(String(n))} className={cn("h-12 rounded-md font-mono text-sm tabular-nums transition-colors duration-150", amount === String(n) ? "bg-accent text-accent-fg" : "bg-raised text-fg shadow-[var(--shadow-border)]")}>
                {n}
              </button>
            ))}
          </div>
          <input className="gunk-input mt-2" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" aria-label="SUPRA amount" />
          <p className="mt-3 font-mono text-sm tabular-nums text-muted">
            {quoting ? "Quoting\u2026" : quote ? `${amount} SUPRA \u2192 ~${quoteHuman.toLocaleString("en-US", { maximumFractionDigits: 0 })} ${ticker}` : "Pick a clip to quote the curve."}
          </p>
          <p className="mt-1 font-mono text-xs text-faint">{SLIPPAGE_BPS / 100}% slippage \u00b7 1% pump fee in the clip</p>
        </section>

        {status ? (
          <p className={cn("text-sm leading-relaxed", /landed|^\+/i.test(status) ? "text-accent" : "text-muted")}>{status}</p>
        ) : null}

        {lastTx ? (
          <a className="inline-flex items-center gap-2 font-mono text-xs text-accent" href={`${SUPRASCAN_TX}/${lastTx}`} target="_blank" rel="noreferrer">
            <ExternalLink className="size-3.5" />{shortAddr(lastTx)}
          </a>
        ) : null}

        <div className="gunk-dock sticky bottom-0 z-10 mt-auto flex flex-col gap-2 pt-3">
          <Button size="lg" className="w-full" disabled={!canBuy} onClick={() => void buy()}>
            {buying ? "Buying\u2026" : `Buy ${ticker} on Atmos`}
          </Button>
          {live ? (
            <Button size="md" variant="ghost" className="w-full" onClick={() => pullChain()}>
              Sync vault to chain \u00b7 {formatChips(chainHuman)}
            </Button>
          ) : null}
          <p className="text-center font-mono text-xs tabular-nums text-faint">Vault {formatChips(bankroll)} \u00b7 chain {formatChips(chainHuman)}</p>
          <a className="inline-flex items-center justify-center gap-1.5 pb-1 font-mono text-xs text-muted" href={ATMOS_APP_URL} target="_blank" rel="noreferrer">
            Token Studio <ExternalLink className="size-3" />
          </a>
        </div>
      </div>
    </ScreenFrame>
  );
}
