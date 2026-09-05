"use client";
import { get, set } from "idb-keyval";
import { decodeEventLog } from "viem";
import { client, rawLogs, explorerLogs, priceFromSqrt, erc20Abi, poolAbi, poolCreatedEvent, pairCreatedEvent, swapEvent, swapV2Event, type LogFilter, type RawLog } from "./rpc";
import { USDC, USDC_DECIMALS, TOPIC_POOL_CREATED, TOPIC_SWAP, TOPIC_PAIR_CREATED, TOPIC_SWAP_V2, AVG_BLOCK_SEC, HISTORY_SEC, RETENTION_SEC, CHUNK_START, CHUNK_MIN, CHUNK_MAX, PARALLEL, POLL_MS, LIQ_EVERY_MS } from "./config";
import type { Pool, Token, Swap, Progress } from "./types";

type Anchor = { b: number; ts: number };
type Listener = () => void;
const lower = (a: string) => a.toLowerCase();
const usdcTopic = ("0x" + USDC.slice(2).padStart(64, "0")) as `0x${string}`;

class Store {
  pools = new Map<string, Pool>();
  tokens = new Map<string, Token>();
  swaps = new Map<string, Swap[]>();      // per pool, sorted by (b, li)
  anchors: Anchor[] = [];
  head = 0; tip = 0; version = 0;
  progress: Progress = { phase: "idle", message: "", done: 0, total: 0, tip: 0, head: 0, rpc: null };
  private listeners = new Set<Listener>();
  private started = false;
  private busy = false;

  subscribe(fn: Listener) { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }
  private emit() { this.version++; this.listeners.forEach((l) => l()); }
  private setProgress(p: Partial<Progress>) { this.progress = { ...this.progress, ...p, tip: this.tip, head: this.head }; this.emit(); }

  // ---- time estimate from anchors ----
  estimateTs(b: number) {
    const a = this.anchors;
    if (!a.length) return Math.floor(Date.now() / 1000);
    let lo: Anchor | null = null, hi: Anchor | null = null;
    for (const x of a) { if (x.b <= b) lo = x; if (x.b >= b) { hi = x; break; } }
    if (lo && hi && hi.b !== lo.b) return Math.round(lo.ts + ((b - lo.b) * (hi.ts - lo.ts)) / (hi.b - lo.b));
    const ref = (lo || hi)!;
    return Math.round(ref.ts + (b - ref.b) * AVG_BLOCK_SEC);
  }
  private async anchor(b: number) {
    if (this.anchors.some((a) => a.b === b)) return;
    const blk = await client.getBlock({ blockNumber: BigInt(b) });
    this.anchors.push({ b, ts: Number(blk.timestamp) });
    this.anchors.sort((x, y) => x.b - y.b);
  }

  // ---- persistence (IndexedDB) ----
  private async load() {
    const [pools, tokens, swaps, head, anchors] = await Promise.all([get<Pool[]>("pools"), get<Token[]>("tokens"), get<Swap[]>("swaps"), get<number>("head"), get<Anchor[]>("anchors")]);
    (pools || []).forEach((p) => this.pools.set(p.address, p));
    (tokens || []).forEach((t) => this.tokens.set(t.address, t));
    for (const s of swaps || []) (this.swaps.get(s.pool) || this.swaps.set(s.pool, []).get(s.pool)!).push(s);
    this.head = head || 0; this.anchors = anchors || [];
  }
  private saveTimer: any = null;
  private save() {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(async () => {
      const cutoff = Math.floor(Date.now() / 1000) - RETENTION_SEC;
      const all: Swap[] = [];
      for (const [pool, arr] of this.swaps) { const kept = arr.filter((s) => s.ts >= cutoff); this.swaps.set(pool, kept); all.push(...kept); }
      await Promise.all([set("pools", [...this.pools.values()]), set("tokens", [...this.tokens.values()]), set("swaps", all), set("head", this.head), set("anchors", this.anchors)]);
    }, 1500);
  }

  // ---- token metadata ----
  private async tokenMeta(addr: string): Promise<Token> {
    const a = addr as `0x${string}`;
    const [name, symbol, decimals, totalSupply] = await Promise.all([
      client.readContract({ address: a, abi: erc20Abi, functionName: "name" }).catch(() => "Unknown"),
      client.readContract({ address: a, abi: erc20Abi, functionName: "symbol" }).catch(() => "???"),
      client.readContract({ address: a, abi: erc20Abi, functionName: "decimals" }).catch(() => 18),
      client.readContract({ address: a, abi: erc20Abi, functionName: "totalSupply" }).catch(() => 0n),
    ]);
    return { address: lower(addr), name: String(name).slice(0, 64), symbol: String(symbol).slice(0, 32), decimals: Number(decimals), totalSupply: String(totalSupply) };
  }

  private async ingestPoolLogs(logs: RawLog[]) {
    const fresh: Pool[] = [];
    for (const log of logs) {
      try {
        const isV3 = (log.topics[0] || "").toLowerCase() === TOPIC_POOL_CREATED;
        let t0: string, t1: string, addr: string, fee: number;
        if (isV3) { const d = decodeEventLog({ abi: [poolCreatedEvent], data: log.data, topics: log.topics as any }); t0 = lower(d.args.token0); t1 = lower(d.args.token1); addr = lower(d.args.pool); fee = Number(d.args.fee); }
        else { const d = decodeEventLog({ abi: [pairCreatedEvent], data: log.data, topics: log.topics as any }); t0 = lower(d.args.token0); t1 = lower(d.args.token1); addr = lower(d.args.pair); fee = 3000; }
        const tokenIsToken0 = t1 === USDC; const token = tokenIsToken0 ? t0 : t1;
        if (token === USDC || this.pools.has(addr)) continue;
        const b = parseInt(log.blockNumber, 16);
        const p: Pool = { address: addr, token, tokenIsToken0, fee, version: isV3 ? 3 : 2, createdBlock: b, createdTs: this.estimateTs(b), price: 0, priceBlock: 0, liquidity: 0 };
        this.pools.set(addr, p); fresh.push(p);
      } catch { /* not a shape we know */ }
    }
    const missing = [...new Set(fresh.map((p) => p.token))].filter((t) => !this.tokens.has(t));
    for (let i = 0; i < missing.length; i += 10) {
      const metas = await Promise.all(missing.slice(i, i + 10).map((t) => this.tokenMeta(t)));
      metas.forEach((m) => this.tokens.set(m.address, m));
    }
    // created timestamps need anchors near creation; sample one anchor per 100k blocks among new pools
    const blocks = [...new Set(fresh.map((p) => Math.floor(p.createdBlock / 100000) * 100000))].slice(0, 30);
    for (const b of blocks) { try { await this.anchor(b); } catch { /* skip */ } }
    fresh.forEach((p) => (p.createdTs = this.estimateTs(p.createdBlock)));
    return fresh.length;
  }

  private ingestSwapLogs(logs: RawLog[]) {
    let n = 0;
    for (const log of logs) {
      const pa = lower(log.address); const pool = this.pools.get(pa); const tok = pool && this.tokens.get(pool.token);
      if (!pool || !tok) continue;
      const isV3 = (log.topics[0] || "").toLowerCase() === TOPIC_SWAP;
      let usdcRaw: bigint, tokRaw: bigint, price: number, trader: string;
      try {
        if (isV3) {
          const d = decodeEventLog({ abi: [swapEvent], data: log.data, topics: log.topics as any });
          usdcRaw = pool.tokenIsToken0 ? d.args.amount1 : d.args.amount0; tokRaw = pool.tokenIsToken0 ? d.args.amount0 : d.args.amount1;
          price = priceFromSqrt(d.args.sqrtPriceX96, pool.tokenIsToken0, tok.decimals); trader = lower(d.args.recipient);
        } else {
          const d = decodeEventLog({ abi: [swapV2Event], data: log.data, topics: log.topics as any });
          const a0 = d.args.amount0In - d.args.amount0Out, a1 = d.args.amount1In - d.args.amount1Out;
          usdcRaw = pool.tokenIsToken0 ? a1 : a0; tokRaw = pool.tokenIsToken0 ? a0 : a1;
          const u = Math.abs(Number(usdcRaw)) / 10 ** USDC_DECIMALS, t = Math.abs(Number(tokRaw)) / 10 ** tok.decimals;
          price = t > 0 ? u / t : 0; trader = lower(d.args.to);
        }
      } catch { continue; }
      const b = parseInt(log.blockNumber, 16), li = parseInt(log.logIndex, 16) || 0;
      const arr = this.swaps.get(pa) || this.swaps.set(pa, []).get(pa)!;
      if (arr.some((s) => s.b === b && s.li === li)) continue;
      arr.push({ pool: pa, b, li, ts: this.estimateTs(b), tx: log.transactionHash, trader, usd: Math.abs(Number(usdcRaw)) / 10 ** USDC_DECIMALS, buy: usdcRaw > 0n, p: price, amt: Math.abs(Number(tokRaw)) / 10 ** tok.decimals });
      arr.sort((x, y) => x.b - y.b || x.li - y.li);
      if (price > 0 && pool.priceBlock <= b) { pool.price = price; pool.priceBlock = b; }
      n++;
    }
    return n;
  }

  // ---- chunked log fetch with adaptive size, PARALLEL chunks at a time ----
  private async fetchRange(f: LogFilter, from: number, to: number, onChunk?: (done: number, total: number) => void): Promise<RawLog[]> {
    const out: RawLog[] = [];
    let chunk = CHUNK_START, cur = from, done = 0;
    const total = to - from + 1;
    while (cur <= to) {
      const jobs: [number, number][] = [];
      for (let i = 0; i < PARALLEL && cur <= to; i++) { const end = Math.min(to, cur + chunk - 1); jobs.push([cur, end]); cur = end + 1; }
      const results = await Promise.all(jobs.map(async ([a, b]) => {
        let span = b - a + 1, c = a; const acc: RawLog[] = [];
        while (c <= b) {
          const e = Math.min(b, c + span - 1);
          try { acc.push(...(await rawLogs(f, c, e))); c = e + 1; }
          catch (err) { if (span <= CHUNK_MIN) throw err; span = Math.max(CHUNK_MIN, Math.floor(span / 2)); }
        }
        return acc;
      }));
      results.forEach((r) => out.push(...r));
      done += jobs.reduce((s, [a, b]) => s + (b - a + 1), 0);
      onChunk?.(done, total);
      const dense = results.some((r) => r.length > 400);
      chunk = dense ? Math.max(CHUNK_MIN, Math.floor(chunk / 2)) : Math.min(CHUNK_MAX, Math.floor(chunk * 1.5));
    }
    return out;
  }

  private async discoverPools(from: number, to: number, full: boolean) {
    const topics = [TOPIC_POOL_CREATED, TOPIC_PAIR_CREATED] as `0x${string}`[];
    if (full) {
      // Whole chain in a couple of explorer calls; fall back to scanning the recent range over RPC.
      try {
        const [a, b, c, d] = await Promise.all([explorerLogs(TOPIC_POOL_CREATED, 1, usdcTopic), explorerLogs(TOPIC_POOL_CREATED, 2, usdcTopic), explorerLogs(TOPIC_PAIR_CREATED, 1, usdcTopic), explorerLogs(TOPIC_PAIR_CREATED, 2, usdcTopic)]);
        return this.ingestPoolLogs([...a, ...b, ...c, ...d]);
      } catch { /* explorer down, use RPC below */ }
    }
    const [x, y] = await Promise.all([this.fetchRange({ topics: [topics, [usdcTopic], null] }, from, to), this.fetchRange({ topics: [topics, null, [usdcTopic]] }, from, to)]);
    return this.ingestPoolLogs([...x, ...y]);
  }

  private async indexRange(from: number, to: number, onChunk?: (d: number, t: number) => void) {
    await this.discoverPools(from, to, false);
    if (!this.pools.size) return 0;
    const logs = await this.fetchRange({ address: [...this.pools.keys()] as `0x${string}`[], topics: [[TOPIC_SWAP, TOPIC_SWAP_V2]] }, from, to, onChunk);
    return this.ingestSwapLogs(logs);
  }

  async refreshLiquidity() {
    const list = [...this.pools.values()];
    for (let i = 0; i < list.length; i += 12) {
      await Promise.all(list.slice(i, i + 12).map(async (p) => {
        const tok = this.tokens.get(p.token); if (!tok) return;
        const pa = p.address as `0x${string}`;
        const [u, t] = await Promise.all([
          client.readContract({ address: USDC, abi: erc20Abi, functionName: "balanceOf", args: [pa] }).catch(() => 0n),
          client.readContract({ address: p.token as `0x${string}`, abi: erc20Abi, functionName: "balanceOf", args: [pa] }).catch(() => 0n),
        ]);
        if (!p.price && p.version === 3) { try { const s0 = await client.readContract({ address: pa, abi: poolAbi, functionName: "slot0" }); p.price = priceFromSqrt(s0[0], p.tokenIsToken0, tok.decimals); } catch { /* keep */ } }
        if (!p.price && p.version === 2 && t > 0n) p.price = (Number(u) / 10 ** USDC_DECIMALS) / (Number(t) / 10 ** tok.decimals);
        p.liquidity = Number(u) / 10 ** USDC_DECIMALS + (Number(t) / 10 ** tok.decimals) * p.price;
      }));
      this.emit();
    }
    this.save();
  }

  // ---- lifecycle ----
  async start() {
    if (this.started || typeof window === "undefined") return; this.started = true;
    try {
      await this.load();
      this.tip = Number(await client.getBlockNumber());
      await this.anchor(this.tip);
      const firstRun = !this.head;
      const from = firstRun ? Math.max(0, this.tip - Math.round(HISTORY_SEC / AVG_BLOCK_SEC)) : this.head + 1;
      if (firstRun) await this.anchor(from);

      this.setProgress({ phase: "pools", message: "Finding USDC pools" });
      await this.discoverPools(from, this.tip, true);
      this.emit();

      this.setProgress({ phase: "history", message: firstRun ? "Loading last 24h of swaps" : "Catching up", done: 0, total: this.tip - from + 1 });
      const n = await this.indexRange(from, this.tip, (done, total) => this.setProgress({ done, total }));
      this.head = this.tip;
      this.save();
      this.setProgress({ phase: "live", message: n ? `${n} swaps loaded, live` : "Live" });
      this.refreshLiquidity().catch(() => {});
      setInterval(() => this.poll(), POLL_MS);
      setInterval(() => this.refreshLiquidity().catch(() => {}), LIQ_EVERY_MS);
    } catch (e: any) {
      this.setProgress({ phase: "error", message: e?.shortMessage || e?.message || "RPC failed" });
      setTimeout(() => { this.started = false; this.start(); }, 8000);
    }
  }

  private async poll() {
    if (this.busy) return; this.busy = true;
    try {
      const tip = Number(await client.getBlockNumber());
      if (tip > this.head) {
        this.tip = tip;
        if (tip % 1000 < 6) await this.anchor(tip);
        const n = await this.indexRange(this.head + 1, tip);
        this.head = tip;
        if (n) this.save();
        this.setProgress({ phase: "live", message: "Live" });
      }
    } catch (e: any) { this.setProgress({ message: `RPC hiccup: ${e?.shortMessage || e?.message}` }); }
    finally { this.busy = false; }
  }
}

export const store = new Store();
