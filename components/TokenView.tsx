"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Header from "./Header";
import Pct from "./Pct";
import Chart from "./Chart";
import { useStore } from "@/lib/useStore";
import { buildCandles } from "@/lib/stats";
import { fmtUsd, fmtPct, fmtAge, fmtNum, short } from "@/lib/format";
import { EXPLORER } from "@/lib/config";

const TFS = ["1m", "5m", "15m", "1h", "4h", "1d"];
type Holders = { count: number | null; holders: { address: string; value: number; pct: number }[] };

function Stat({ k, v, tone }: { k: string; v: React.ReactNode; tone?: number | null }) {
  return <div className="rounded border border-line bg-panel px-3 py-2"><div className="text-xs text-mist">{k}</div><div className={`num text-base font-medium ${tone == null ? "" : tone >= 0 ? "text-up" : "text-down"}`}>{v}</div></div>;
}

export default function TokenView({ address }: { address: string }) {
  const a = address.toLowerCase();
  const { store, rows, progress } = useStore();
  const [tf, setTf] = useState("5m"); const [mode, setMode] = useState<"price" | "mc">("price"); const [tab, setTab] = useState<"tx" | "holders" | "similar">("tx");
  const [holders, setHolders] = useState<Holders | null>(null);
  const token = store.tokens.get(a);
  const row = rows.find((r) => r.token === a) || null;
  const pools = [...store.pools.values()].filter((p) => p.token === a);
  const trades = useMemo(() => pools.flatMap((p) => store.swaps.get(p.address) || []).sort((x, y) => y.b - x.b || y.li - x.li).slice(0, 300), [store.version, rows]);
  const deepest = pools.sort((x, y) => y.liquidity - x.liquidity)[0];
  const candles = useMemo(() => buildCandles(deepest ? store.swaps.get(deepest.address) || [] : [], tf), [tf, store.version, rows]);
  const supply = token ? Number(token.totalSupply) / 10 ** token.decimals || 1 : 1;
  const similar = token ? [...store.tokens.values()].filter((t) => t.address !== a && (t.symbol.toLowerCase() === token.symbol.toLowerCase() || t.name.toLowerCase() === token.name.toLowerCase())) : [];
  const now = Date.now() / 1000;

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const [info, list] = await Promise.all([
          fetch(`${EXPLORER}/api/v2/tokens/${a}`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
          fetch(`${EXPLORER}/api/v2/tokens/${a}/holders`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
        ]);
        const total = info?.total_supply ? Number(info.total_supply) : 0;
        if (live) setHolders({ count: info?.holders != null ? Number(info.holders) : null, holders: (list?.items || []).slice(0, 50).map((h: any) => ({ address: h.address?.hash || "", value: Number(h.value || 0), pct: total ? (Number(h.value || 0) / total) * 100 : 0 })) });
      } catch { if (live) setHolders({ count: null, holders: [] }); }
    })();
    return () => { live = false; };
  }, [a]);

  if (!token) return (<div><Header /><main className="mx-auto max-w-7xl px-4 py-10 text-mist">{progress.phase === "live" || progress.phase === "error" ? "This contract has no USDC pool on Arc, or it is newer than what the browser has loaded so far." : progress.message || "Loading"}</main></div>);

  const tabBtn = (t: typeof tab, label: string) => <button onClick={() => setTab(t)} className={`px-3 py-1.5 border-b-2 ${tab === t ? "border-arc text-paper" : "border-transparent text-mist"}`}>{label}</button>;
  const seg = "inline-flex overflow-hidden rounded border border-line text-xs";

  return (
    <div>
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-4">
        <div className="mb-4 flex flex-wrap items-baseline gap-3"><h1 className="text-2xl font-semibold">{token.symbol}</h1><span className="text-mist">{token.name}</span><a className="break-all text-xs text-mist underline" href={`${EXPLORER}/token/${token.address}`} target="_blank" rel="noreferrer">{token.address}</a></div>
        <div className="mb-2 grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-8">
          <Stat k="Price" v={fmtUsd(row?.price || 0, { sub: true })} /><Stat k="Market cap" v={fmtUsd(row?.mcap || 0)} /><Stat k="Liquidity" v={fmtUsd(row?.liquidity || 0)} /><Stat k="Volume 24h" v={fmtUsd(row?.vol24h || 0)} />
          <Stat k="Txns 24h" v={<>{row?.txns24h ?? 0} <span className="text-xs"><span className="text-up">{row?.buys24h ?? 0}</span>/<span className="text-down">{row?.sells24h ?? 0}</span></span></>} />
          <Stat k="Traders 24h" v={row?.traders24h ?? 0} /><Stat k="Holders" v={holders?.count?.toLocaleString() ?? ".."} /><Stat k="Age" v={fmtAge(row?.createdTs || 0, now)} />
        </div>
        <div className="mb-4 grid grid-cols-4 gap-2">
          <Stat k="5m" v={fmtPct(row?.ch5m ?? null)} tone={row?.ch5m} /><Stat k="1h" v={fmtPct(row?.ch1h ?? null)} tone={row?.ch1h} /><Stat k="6h" v={fmtPct(row?.ch6h ?? null)} tone={row?.ch6h} /><Stat k="24h" v={fmtPct(row?.ch24h ?? null)} tone={row?.ch24h} />
        </div>
        <div className="mb-4 rounded border border-line bg-panel">
          <div className="flex items-center gap-3 border-b border-line px-3 py-2">
            <span className={seg}>{TFS.map((t) => <button key={t} onClick={() => setTf(t)} className={`px-2.5 py-1 ${tf === t ? "bg-line text-paper" : "text-mist"}`}>{t}</button>)}</span>
            <span className={seg}>{(["price", "mc"] as const).map((m) => <button key={m} onClick={() => setMode(m)} className={`px-2.5 py-1 ${mode === m ? "bg-line text-paper" : "text-mist"}`}>{m === "price" ? "Price" : "MC"}</button>)}</span>
            <span className="ml-auto text-xs text-mist">{candles.filter((c) => c.volume > 0).length} candles with trades</span>
          </div>
          <Chart candles={candles} scale={mode === "mc" ? supply : 1} />
        </div>
        <p className="mb-4 text-xs text-mist">Supply {fmtNum(supply)} {token.symbol}, {token.decimals} decimals. {pools.map((p) => <span key={p.address} className="ml-3">V{p.version} pool <a className="underline" target="_blank" rel="noreferrer" href={`${EXPLORER}/address/${p.address}`}>{short(p.address)}</a> {(p.fee / 10000).toFixed(2)}%, {fmtUsd(p.liquidity)} liq</span>)}</p>
        <div className="mb-2 flex text-sm">{tabBtn("tx", "Transactions")}{tabBtn("holders", "Holders")}{tabBtn("similar", "Similar tokens")}</div>
        <div className="overflow-x-auto rounded border border-line">
          {tab === "tx" && <table className="w-full min-w-[800px] text-sm"><thead className="bg-panel text-xs text-mist"><tr><th className="px-3 py-2 text-left font-medium">Time</th><th className="px-3 py-2 text-left font-medium">Type</th><th className="px-3 py-2 text-right font-medium">USD</th><th className="px-3 py-2 text-right font-medium">{token.symbol}</th><th className="px-3 py-2 text-right font-medium">Price</th><th className="px-3 py-2 text-left font-medium">Trader</th><th className="px-3 py-2 text-right font-medium">Txn</th></tr></thead>
            <tbody>{trades.length ? trades.map((t) => <tr key={`${t.tx}-${t.li}`} className="border-t border-line"><td className="px-3 py-1.5 text-mist">{fmtAge(t.ts, now)}</td><td className={`px-3 py-1.5 ${t.buy ? "text-up" : "text-down"}`}>{t.buy ? "Buy" : "Sell"}</td><td className="num px-3 py-1.5 text-right">{fmtUsd(t.usd)}</td><td className="num px-3 py-1.5 text-right">{fmtNum(t.amt)}</td><td className="num px-3 py-1.5 text-right">{fmtUsd(t.p, { sub: true })}</td><td className="px-3 py-1.5"><a className="text-mist underline" target="_blank" rel="noreferrer" href={`${EXPLORER}/address/${t.trader}`}>{t.trader ? short(t.trader) : ".."}</a></td><td className="px-3 py-1.5 text-right"><a className="text-mist underline" target="_blank" rel="noreferrer" href={`${EXPLORER}/tx/${t.tx}`}>{short(t.tx)}</a></td></tr>)
              : <tr><td colSpan={7} className="px-3 py-8 text-center text-mist">No swaps in the loaded window.</td></tr>}</tbody></table>}
          {tab === "holders" && (holders == null ? <div className="px-3 py-8 text-center text-mist">Loading holders</div> : holders.holders.length ? <table className="w-full text-sm"><thead className="bg-panel text-xs text-mist"><tr><th className="px-3 py-2 text-left font-medium">#</th><th className="px-3 py-2 text-left font-medium">Holder</th><th className="px-3 py-2 text-right font-medium">Amount</th><th className="px-3 py-2 text-right font-medium">%</th></tr></thead>
            <tbody>{holders.holders.map((h, i) => <tr key={h.address} className="border-t border-line"><td className="px-3 py-1.5 text-mist">{i + 1}</td><td className="px-3 py-1.5"><a className="text-mist underline" target="_blank" rel="noreferrer" href={`${EXPLORER}/address/${h.address}`}>{h.address}</a></td><td className="num px-3 py-1.5 text-right">{fmtNum(h.value / 10 ** token.decimals)}</td><td className="num px-3 py-1.5 text-right">{h.pct.toFixed(2)}%</td></tr>)}</tbody></table>
            : <div className="px-3 py-8 text-center text-mist">Holder data is not available from the explorer for this token yet.</div>)}
          {tab === "similar" && (similar.length ? <table className="w-full text-sm"><thead className="bg-panel text-xs text-mist"><tr><th className="px-3 py-2 text-left font-medium">Token</th><th className="px-3 py-2 text-left font-medium">Contract</th></tr></thead>
            <tbody>{similar.map((t) => <tr key={t.address} className="border-t border-line"><td className="px-3 py-1.5"><Link href={`/token/${t.address}`} className="no-underline"><span className="font-semibold">{t.symbol}</span><span className="ml-2 text-mist">{t.name}</span></Link></td><td className="px-3 py-1.5 text-mist">{t.address}</td></tr>)}</tbody></table>
            : <div className="px-3 py-8 text-center text-mist">No other token shares this name or ticker. Watch for copycats before you trade.</div>)}
        </div>
      </main>
    </div>
  );
}
