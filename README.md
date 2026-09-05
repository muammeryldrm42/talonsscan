# Talons Scan

Screener for every USDC pair on Arc mainnet (chain 5042), Uniswap V2 and V3 style pools. Deploys to Vercel as a plain Next.js app. No database, no environment variables, no cron, no third-party service to connect.

How it works: the browser talks to Arc RPC directly. On first visit it pulls every USDC pool ever created (one explorer call, RPC scan as fallback), then the last 24 hours of swaps in parallel chunks, then polls for new blocks every 3 seconds. Everything (prices, changes, volume, traders, candles) is computed in the browser and kept in IndexedDB, so the next visit only fetches what happened since. Liquidity is read from pool balances once a minute. Holders come from the Arc Blockscout explorer.

## Deploy

Push to GitHub, import in Vercel, deploy. There is nothing to configure.

Local: `npm install`, `npm run dev`.

## Trade-offs

- First load takes a few seconds while 24h of swaps stream in; a progress percentage is shown. Returning visitors load in about a second.
- Data lives in each visitor's browser, so two people see the same chain but load it independently. There is no shared server state to break.
- If every public Arc RPC is down, the page says so and retries every 8 seconds. RPC list is in `lib/config.ts`.
- Candles and history cover what the browser has loaded (24h on first visit, growing to 7 days as you keep coming back).
