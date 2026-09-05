export const CHAIN_ID = 5042;
export const USDC = "0x3600000000000000000000000000000000000000" as const;
export const USDC_DECIMALS = 6;
export const EXPLORER = "https://arc-mainnet.cloud.blockscout.com";

// Browser talks to these directly. Order is a starting point; the client re-ranks by latency.
export const RPC_ENDPOINTS: string[] = [
  "https://5042.rpc.thirdweb.com",
  "https://arc-mainnet.infura.io/v3/b6bf7d3508c941499b10025c0776eaf8",
  "https://rpc.blockdaemon.mainnet.arc.io",
  "https://arc-mainnet.cloud.blockscout.com/api/eth-rpc",
  "https://rpc.arc-scan.org",
  "https://ac-rpc.theleak.cx",
];

export const TOPIC_POOL_CREATED = "0x783cca1c0412dd0d695e784568c96da2e9c22ff989357a2e8b1d9b2b4e6b7118" as const;
export const TOPIC_SWAP = "0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67" as const;
export const TOPIC_PAIR_CREATED = "0x0d3648bd0f6ba80134a33ba9275ac585d9d315f0ad8355cddefde31afa28d0e9" as const;
export const TOPIC_SWAP_V2 = "0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822" as const;

export const AVG_BLOCK_SEC = 0.5;
export const HISTORY_SEC = 24 * 3600;        // loaded on first visit
export const RETENTION_SEC = 7 * 24 * 3600;  // kept in the browser cache
export const CHUNK_START = 5000;
export const CHUNK_MIN = 250;
export const CHUNK_MAX = 20000;
export const PARALLEL = 4;
export const POLL_MS = 3000;
export const LIQ_EVERY_MS = 60_000;
