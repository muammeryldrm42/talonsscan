import type { Pool, Token, Swap, Row } from "./types";

const pct = (now: number, then: number | null) => (then == null || then === 0 || now === 0 ? null : ((now - then) / then) * 100);
function priceBefore(swaps: Swap[], ts: number): number | null {
  let p: number | null = null;
  for (const s of swaps) { if (s.p <= 0) continue; if (s.ts <= ts) p = s.p; else break; }
  if (p == null) { const f = swaps.find((s) => s.ts > ts && s.p > 0); p = f ? f.p : null; }
  return p;
}

export function buildRows(pools: Map<string, Pool>, tokens: Map<string, Token>, swaps: Map<string, Swap[]>): Row[] {
  const now = Math.floor(Date.now() / 1000);
  const rows: Row[] = [];
  for (const p of pools.values()) {
    const tok = tokens.get(p.token); if (!tok) continue;
    const sw = swaps.get(p.address) || [];
    const last = [...sw].reverse().find((s) => s.p > 0);
    const price = last?.p || p.price || 0;
    const supply = Number(tok.totalSupply) / 10 ** tok.decimals;
    const day = sw.filter((s) => s.ts >= now - 86400);
    const spark = new Array(12).fill(0);
    for (const s of day) { const i = Math.min(11, Math.floor((s.ts - (now - 86400)) / 7200)); if (s.p > 0) spark[i] = s.p; }
    let lastP = spark.find((v) => v > 0) || price; const sp = spark.map((v) => (v > 0 ? (lastP = v) : lastP));
    rows.push({
      token: p.token, name: tok.name, symbol: tok.symbol, pool: p.address, fee: p.fee, version: p.version,
      price, mcap: price * supply,
      ch5m: pct(price, priceBefore(sw, now - 300)), ch1h: pct(price, priceBefore(sw, now - 3600)), ch6h: pct(price, priceBefore(sw, now - 21600)), ch24h: pct(price, priceBefore(sw, now - 86400)),
      vol24h: day.reduce((a, s) => a + s.usd, 0), txns24h: day.length, buys24h: day.filter((s) => s.buy).length, sells24h: day.filter((s) => !s.buy).length,
      traders24h: new Set(day.map((s) => s.trader).filter(Boolean)).size,
      liquidity: p.liquidity, createdTs: p.createdTs, lastTs: sw.length ? sw[sw.length - 1].ts : 0, spark: day.length ? sp : [],
    });
  }
  const best = new Map<string, Row>();
  for (const r of rows) { const c = best.get(r.token); if (!c || r.liquidity > c.liquidity || (r.liquidity === c.liquidity && r.vol24h > c.vol24h)) best.set(r.token, r); }
  return [...best.values()].sort((a, b) => b.vol24h - a.vol24h || b.liquidity - a.liquidity);
}

export type Candle = { time: number; open: number; high: number; low: number; close: number; volume: number };
const TF: Record<string, number> = { "1m": 60, "5m": 300, "15m": 900, "1h": 3600, "4h": 14400, "1d": 86400 };
export function buildCandles(swaps: Swap[], tf: string): Candle[] {
  const sec = TF[tf] || 300;
  const m = new Map<number, Candle>();
  for (const s of swaps) {
    if (s.p <= 0) continue;
    const t = Math.floor(s.ts / sec) * sec;
    const c = m.get(t);
    if (!c) m.set(t, { time: t, open: s.p, high: s.p, low: s.p, close: s.p, volume: s.usd });
    else { c.high = Math.max(c.high, s.p); c.low = Math.min(c.low, s.p); c.close = s.p; c.volume += s.usd; }
  }
  const arr = [...m.values()].sort((a, b) => a.time - b.time);
  const out: Candle[] = [];
  for (let i = 0; i < arr.length; i++) {
    out.push(arr[i]);
    if (i + 1 < arr.length) { let t = arr[i].time + sec, g = 0; while (t < arr[i + 1].time && g++ < 3000) { out.push({ time: t, open: arr[i].close, high: arr[i].close, low: arr[i].close, close: arr[i].close, volume: 0 }); t += sec; } }
  }
  return out.slice(-1000);
}
