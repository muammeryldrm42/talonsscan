"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import Header from "./Header";
import Pct from "./Pct";
import Spark from "./Spark";
import { useStore } from "@/lib/useStore";
import { fmtUsd, fmtAge, fmtNum, short } from "@/lib/format";
import type { Row } from "@/lib/types";

type Key = keyof Row;
const cols: { key: Key; label: string }[] = [
  { key: "mcap", label: "MCap" }, { key: "price", label: "Price" }, { key: "createdTs", label: "Age" }, { key: "txns24h", label: "Txns" },
  { key: "vol24h", label: "Volume" }, { key: "traders24h", label: "Traders" }, { key: "ch5m", label: "5m" }, { key: "ch1h", label: "1h" },
  { key: "ch6h", label: "6h" }, { key: "ch24h", label: "24h" }, { key: "liquidity", label: "Liquidity" },
];
const inp = "rounded border border-line bg-panel px-2 py-1 text-xs text-paper placeholder:text-mist focus:border-arc focus:outline-none";

export default function Screener() {
  const { store, rows, progress } = useStore();
  const [q, setQ] = useState(""); const [ver, setVer] = useState(0); const [minLiq, setMinLiq] = useState(""); const [minVol, setMinVol] = useState(""); const [maxAge, setMaxAge] = useState(0);
  const [sort, setSort] = useState<{ key: Key; dir: 1 | -1 }>({ key: "vol24h", dir: -1 });
  const now = Date.now() / 1000;

  const list = useMemo(() => {
    const s = q.trim().toLowerCase(), ml = +minLiq || 0, mv = +minVol || 0;
    return rows.filter((r) => (!s || r.symbol.toLowerCase().includes(s) || r.name.toLowerCase().includes(s) || r.token.includes(s) || r.pool.includes(s)) && (!ver || r.version === ver) && r.liquidity >= ml && r.vol24h >= mv && (!maxAge || now - r.createdTs <= maxAge))
      .sort((a, b) => { const x = a[sort.key] as number | null, y = b[sort.key] as number | null; if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1; return (x - y) * sort.dir; });
  }, [rows, q, ver, minLiq, minVol, maxAge, sort]);

  const tot = rows.reduce((a, r) => ({ v: a.v + r.vol24h, l: a.l + r.liquidity, t: a.t + r.txns24h }), { v: 0, l: 0, t: 0 });
  const trending = [...rows].filter((r) => r.txns24h > 0).sort((a, b) => b.vol24h * (1 + b.txns24h) - a.vol24h * (1 + a.txns24h)).slice(0, 10);
  const feed = useMemo(() => { const all: (typeof rows[number] extends never ? never : any)[] = []; for (const [pool, arr] of store.swaps) { const p = store.pools.get(pool); const t = p && store.tokens.get(p.token); if (!t) continue; for (const s of arr.slice(-30)) all.push({ ...s, symbol: t.symbol, token: t.address }); } return all.sort((a, b) => b.b - a.b || b.li - a.li).slice(0, 60); }, [store.version, rows]);
  const toggle = (key: Key) => setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: -1 }));
  const loading = progress.phase === "pools" || progress.phase === "history";

  return (
    <div>
      <Header><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search ticker, name or contract" className="w-64 rounded border border-line bg-panel px-3 py-1.5 text-sm placeholder:text-mist focus:border-arc focus:outline-none md:w-80" /></Header>
      <main className="mx-auto max-w-7xl px-4 py-4">
        <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
          {[["Tokens", String(rows.length)], ["24h volume", fmtUsd(tot.v)], ["Liquidity", fmtUsd(tot.l)], ["24h txns", tot.t.toLocaleString()]].map(([k, v]) => (
            <div key={k} className="rounded border border-line bg-panel px-3 py-2"><div className="text-xs text-mist">{k}</div><div className="num text-base font-medium">{v}</div></div>
          ))}
        </div>
        <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
          {trending.length ? trending.map((r, i) => (
            <Link key={r.token} href={`/token/${r.token}`} className="flex shrink-0 items-baseline gap-2 rounded border border-line bg-panel px-2.5 py-1.5 text-sm no-underline"><span className="text-xs text-mist">#{i + 1}</span><span className="font-semibold">{r.symbol}</span><Pct v={r.ch24h} /></Link>
          )) : <span className="text-xs text-mist">Trending appears once swaps come in.</span>}
        </div>
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-mist">
          <span className="inline-flex overflow-hidden rounded border border-line">{[0, 2, 3].map((v) => <button key={v} onClick={() => setVer(v)} className={`px-2.5 py-1 ${ver === v ? "bg-line text-paper" : ""}`}>{v ? `V${v}` : "All"}</button>)}</span>
          <input className={inp + " w-28"} type="number" placeholder="Min liquidity $" value={minLiq} onChange={(e) => setMinLiq(e.target.value)} />
          <input className={inp + " w-32"} type="number" placeholder="Min 24h volume $" value={minVol} onChange={(e) => setMinVol(e.target.value)} />
          <select className={inp} value={maxAge} onChange={(e) => setMaxAge(+e.target.value)}><option value={0}>Any age</option><option value={86400}>Under 1 day</option><option value={604800}>Under 7 days</option><option value={2592000}>Under 30 days</option></select>
          <button onClick={() => { setQ(""); setVer(0); setMinLiq(""); setMinVol(""); setMaxAge(0); }} className="hover:text-paper">Clear</button>
          <span className="ml-auto flex items-center gap-4">
            {progress.tip ? <span>Block {progress.tip.toLocaleString()}</span> : null}
            <span className={progress.phase === "live" ? "text-up" : progress.phase === "error" ? "text-down" : ""}>
              {progress.phase === "history" && progress.total ? `${progress.message} ${Math.round((progress.done / progress.total) * 100)}%` : progress.message || "Connecting"}
            </span>
          </span>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
          <div>
            <div className="overflow-x-auto rounded border border-line">
              <table className="w-full min-w-[1000px] text-sm">
                <thead className="bg-panel text-xs text-mist"><tr>
                  <th className="px-3 py-2 text-left font-medium">#</th><th className="px-3 py-2 text-left font-medium">Token</th><th className="px-3 py-2 text-left font-medium">Trend</th>
                  {cols.map((c) => <th key={c.key} className="px-3 py-2 text-right font-medium"><button onClick={() => toggle(c.key)} className={sort.key === c.key ? "text-paper" : "hover:text-paper"}>{c.label}{sort.key === c.key ? (sort.dir === -1 ? " \u25BE" : " \u25B4") : ""}</button></th>)}
                </tr></thead>
                <tbody>
                  {list.map((r, i) => (
                    <tr key={r.pool} className="border-t border-line hover:bg-panel">
                      <td className="px-3 py-2 text-mist">{i + 1}</td>
                      <td className="px-3 py-2"><Link href={`/token/${r.token}`} className="block no-underline"><span className="font-semibold">{r.symbol}</span><span className="ml-2 text-mist">{r.name}</span><span className="ml-2 rounded border border-line px-1 text-[10px] text-mist align-middle">V{r.version}</span><div className="text-xs text-mist">{short(r.token)} <span className="ml-2">{(r.fee / 10000).toFixed(2)}%</span></div></Link></td>
                      <td className="px-3 py-2"><Spark data={r.spark} up={(r.ch24h ?? 0) >= 0} /></td>
                      <td className="num px-3 py-2 text-right">{fmtUsd(r.mcap)}</td><td className="num px-3 py-2 text-right">{fmtUsd(r.price, { sub: true })}</td><td className="num px-3 py-2 text-right">{fmtAge(r.createdTs, now)}</td>
                      <td className="num px-3 py-2 text-right">{r.txns24h}<div className="text-xs"><span className="text-up">{r.buys24h}</span> <span className="text-mist">/</span> <span className="text-down">{r.sells24h}</span></div></td>
                      <td className="num px-3 py-2 text-right">{fmtUsd(r.vol24h)}</td><td className="num px-3 py-2 text-right">{r.traders24h}</td>
                      <td className="num px-3 py-2 text-right"><Pct v={r.ch5m} /></td><td className="num px-3 py-2 text-right"><Pct v={r.ch1h} /></td><td className="num px-3 py-2 text-right"><Pct v={r.ch6h} /></td><td className="num px-3 py-2 text-right"><Pct v={r.ch24h} /></td>
                      <td className="num px-3 py-2 text-right">{fmtUsd(r.liquidity)}</td>
                    </tr>
                  ))}
                  {!list.length && <tr><td colSpan={14} className="px-3 py-10 text-center text-mist">{loading ? progress.message : progress.phase === "error" ? `Could not reach Arc RPC: ${progress.message}. Retrying.` : rows.length ? "No token matches these filters." : "No USDC pools found."}</td></tr>}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-mist">Read straight from Arc RPC in your browser. USDC pairs on Uniswap V2 and V3 style pools, one row per token. Nothing is stored on a server; your browser keeps 7 days of swaps locally.</p>
          </div>
          <aside className="max-h-[70vh] overflow-auto rounded border border-line bg-panel xl:sticky xl:top-[70px] xl:self-start">
            <div className="border-b border-line px-3 py-2 text-xs text-mist">Live feed</div>
            {feed.length ? feed.map((s) => (
              <Link key={`${s.tx}-${s.li}`} href={`/token/${s.token}`} className="grid grid-cols-[34px_1fr_auto] gap-2 border-b border-line px-3 py-1.5 text-xs no-underline hover:bg-ink">
                <span className="text-mist">{fmtAge(s.ts, now)}</span>
                <span><span className={s.buy ? "text-up" : "text-down"}>{s.buy ? "Buy" : "Sell"}</span> <span className="font-semibold">{s.symbol}</span><div className="text-mist">{short(s.trader || s.tx)}</div></span>
                <span className="num text-right">{fmtUsd(s.usd)}<div className="text-mist">{fmtNum(s.amt)}</div></span>
              </Link>
            )) : <div className="px-3 py-8 text-center text-xs text-mist">Waiting for swaps</div>}
          </aside>
        </div>
      </main>
    </div>
  );
}
