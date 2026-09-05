import { createPublicClient, fallback, http, defineChain, parseAbiItem, type Log } from "viem";
import { CHAIN_ID, RPC_ENDPOINTS, USDC_DECIMALS, EXPLORER } from "./config";

export const arc = defineChain({ id: CHAIN_ID, name: "Arc", nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 }, rpcUrls: { default: { http: RPC_ENDPOINTS } } });

export const client = createPublicClient({
  chain: arc,
  transport: fallback(
    RPC_ENDPOINTS.map((u) => http(u, { timeout: 12_000, retryCount: 0, batch: { batchSize: 40, wait: 10 } })),
    { rank: { interval: 60_000, sampleCount: 2, timeout: 4000 }, retryCount: 1, retryDelay: 300 }
  ),
});

export const poolCreatedEvent = parseAbiItem("event PoolCreated(address indexed token0, address indexed token1, uint24 indexed fee, int24 tickSpacing, address pool)");
export const swapEvent = parseAbiItem("event Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)");
export const pairCreatedEvent = parseAbiItem("event PairCreated(address indexed token0, address indexed token1, address pair, uint256 index)");
export const swapV2Event = parseAbiItem("event Swap(address indexed sender, uint256 amount0In, uint256 amount1In, uint256 amount0Out, uint256 amount1Out, address indexed to)");

export const erc20Abi = [
  { type: "function", name: "name", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "totalSupply", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
] as const;
export const poolAbi = [{ type: "function", name: "slot0", stateMutability: "view", inputs: [], outputs: [{ type: "uint160" }, { type: "int24" }, { type: "uint16" }, { type: "uint16" }, { type: "uint16" }, { type: "uint8" }, { type: "bool" }] }] as const;

const Q192 = 2n ** 192n;
export function priceFromSqrt(sqrt: bigint, tokenIsToken0: boolean, dec: number): number {
  const raw = Number((sqrt * sqrt * 10n ** 18n) / Q192) / 1e18;
  if (!isFinite(raw) || raw === 0) return 0;
  return tokenIsToken0 ? raw * 10 ** (dec - USDC_DECIMALS) : (1 / raw) * 10 ** (dec - USDC_DECIMALS);
}

export type LogFilter = { address?: `0x${string}`[]; topics: (`0x${string}` | `0x${string}`[] | null)[] };
export type RawLog = { address: string; topics: `0x${string}`[]; data: `0x${string}`; blockNumber: string; transactionHash: string; logIndex: string };

export async function rawLogs(f: LogFilter, from: number, to: number): Promise<RawLog[]> {
  return (await client.request({
    method: "eth_getLogs",
    params: [{ fromBlock: `0x${from.toString(16)}`, toBlock: `0x${to.toString(16)}`, address: f.address, topics: f.topics }],
  })) as unknown as RawLog[];
}

// Blockscout's Etherscan style logs endpoint. One request can cover the whole chain for a rare topic like PoolCreated.
export async function explorerLogs(topic0: string, topicIdx: 1 | 2, topicVal: string): Promise<RawLog[]> {
  const out: RawLog[] = [];
  let page = 1;
  for (;;) {
    const u = `${EXPLORER}/api?module=logs&action=getLogs&fromBlock=0&toBlock=latest&topic0=${topic0}&topic${topicIdx}=${topicVal}&topic0_${topicIdx}_opr=and&page=${page}&offset=1000`;
    const res = await fetch(u, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`explorer ${res.status}`);
    const j = (await res.json()) as { status: string; result: any };
    if (j.status !== "1" || !Array.isArray(j.result)) break;
    out.push(...(j.result as RawLog[]));
    if (j.result.length < 1000 || page >= 20) break;
    page++;
  }
  return out;
}
