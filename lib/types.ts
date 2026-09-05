export type Pool = { address: string; token: string; tokenIsToken0: boolean; fee: number; version: 2 | 3; createdBlock: number; createdTs: number; price: number; priceBlock: number; liquidity: number };
export type Token = { address: string; name: string; symbol: string; decimals: number; totalSupply: string };
export type Swap = { pool: string; b: number; li: number; ts: number; tx: string; trader: string; usd: number; buy: boolean; p: number; amt: number };
export type Row = {
  token: string; name: string; symbol: string; pool: string; fee: number; version: number;
  price: number; mcap: number; ch5m: number | null; ch1h: number | null; ch6h: number | null; ch24h: number | null;
  vol24h: number; txns24h: number; buys24h: number; sells24h: number; traders24h: number;
  liquidity: number; createdTs: number; lastTs: number; spark: number[];
};
export type Progress = { phase: "idle" | "pools" | "history" | "live" | "error"; message: string; done: number; total: number; tip: number; head: number; rpc: string | null };
