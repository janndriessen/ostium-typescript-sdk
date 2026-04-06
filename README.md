# ostium-typescript-sdk

[![CI](https://github.com/janndriessen/ostium-typescript-sdk/actions/workflows/ci.yml/badge.svg)](https://github.com/janndriessen/ostium-typescript-sdk/actions/workflows/ci.yml)

Unofficial TypeScript SDK for [Ostium](https://ostium.io) — a decentralized perpetuals exchange on Arbitrum.

> **v0.1.0** — Early release. Core trading flow is fully implemented and tested (97% statement coverage, 100% line coverage). API may change before v1.

## Install

```bash
pnpm add github:janndriessen/ostium-typescript-sdk
```

## Quick Start

```typescript
import { OstiumSDK } from "ostium-typescript-sdk";

const sdk = new OstiumSDK({
  network: "mainnet",
  privateKey: process.env.PRIVATE_KEY,
  rpcUrl: process.env.RPC_URL,
});

// Fetch prices (no wallet needed)
const price = await sdk.price.getPrice("BTC", "USD");

// Query pairs
const pairs = await sdk.subgraph.getPairs();

// Open a trade
const result = await sdk.trading.openTrade(
  {
    collateral: 100,
    leverage: 10,
    pairIndex: 0,
    direction: "long",
    orderType: "market",
  },
  price.mid,
);

console.log(`Trade opened: ${result.transactionHash}`);
console.log(`Order ID: ${result.orderId}`);

// Close the trade
await sdk.trading.closeTrade(0, tradeIndex, price.mid);
```

## Read-Only Mode

Omit `privateKey` to use the SDK without a wallet. Price fetching, subgraph queries, and any read-only RPC calls (including `connect()` for chain-ID validation) work without one. Pass an `rpcUrl` to point at your own node, or omit it to use viem's default for the selected chain.

```typescript
const sdk = new OstiumSDK({ network: "mainnet", rpcUrl: process.env.RPC_URL });

await sdk.connect(); // optional: validates RPC reachability + chain ID
const prices = await sdk.price.getLatestPrices();
const trades = await sdk.subgraph.getOpenTrades("0x...");
```

## Trading Methods

| Method                                                                        | Description                                 |
| ----------------------------------------------------------------------------- | ------------------------------------------- |
| `openTrade(params, atPrice)`                                                  | Open a market, limit, or stop trade         |
| `closeTrade(pairIndex, tradeIndex, marketPrice, closePercentage?, slippage?)` | Close all or part of a position             |
| `updateTp(pairIndex, tradeIndex, newTp)`                                      | Set/update take profit (0 to remove)        |
| `updateSl(pairIndex, tradeIndex, newSl)`                                      | Set/update stop loss (0 to remove)          |
| `addCollateral(pairIndex, tradeIndex, amount)`                                | Add USDC collateral to an open position     |
| `removeCollateral(pairIndex, tradeIndex, amount)`                             | Remove USDC collateral from an open position|
| `cancelLimitOrder(pairIndex, orderIndex)`                                     | Cancel a pending limit/stop order           |
| `updateLimitOrder(pairIndex, orderIndex, price?, tp?, sl?)`                   | Update an open limit order                  |
| `openTradeMarketTimeout(orderId)`                                             | Recover a timed-out pending open (cancel)   |
| `closeTradeMarketTimeout(orderId, retry?)`                                    | Recover a timed-out pending close           |

All write methods return a typed `TransactionResult` with `transactionHash`, `receipt`, and optional `orderId`.

### Timeout Recovery

Market orders on Ostium are filled asynchronously: `openTrade` / `closeTrade` emit a `PriceRequested` event, and an off-chain oracle fulfills the price shortly after. If the oracle misses its window, the order is left pending and can be recovered manually using the `orderId` returned from the original call.

```typescript
const { orderId } = await sdk.trading.openTrade(params, price.mid);

// ... if the order never fulfills within the timeout window:
await sdk.trading.openTradeMarketTimeout(orderId!);
// Cancels the pending open and refunds collateral. There is no retry
// path — the market order's original price intent is stale.

// For a stalled close, you can retry (re-request a fresh oracle price)
// or cancel (leave the position open):
await sdk.trading.closeTradeMarketTimeout(orderId!, true);  // retry
await sdk.trading.closeTradeMarketTimeout(orderId!, false); // cancel (default)
```

`orderId` can also be sourced from subgraph queries — anywhere in the SDK that returns an id works directly.

## Subgraph Queries

| Method                      | Description                                |
| --------------------------- | ------------------------------------------ |
| `getPairs()`                | All trading pairs with funding/OI/fee data |
| `getPairDetails(pairIndex)` | Single pair by index                       |
| `getOpenTrades(address)`    | Open positions for a trader                |
| `getOrders(address)`        | Active limit/stop orders for a trader      |

## Price API

| Method               | Description                                |
| -------------------- | ------------------------------------------ |
| `getLatestPrices()`  | All live prices                            |
| `getPrice(from, to)` | Single pair price (e.g., `"BTC"`, `"USD"`) |

## Balance

Read-only USDC and native ETH balance queries. Works without a wallet (pass an `rpcUrl` or use the chain default). All methods return raw onchain values as `bigint` — format with viem's `formatUnits` / `formatEther` for display.

| Method                   | Description                                          |
| ------------------------ | ---------------------------------------------------- |
| `getUsdc(address)`       | USDC balance in 6-decimal base units                 |
| `getEth(address)`        | Native ETH balance in wei                            |
| `getBalances(address)`   | Both balances in parallel (single call, `Promise.all`) |

```typescript
import { formatUnits, formatEther } from "viem";

const sdk = new OstiumSDK({ network: "mainnet" });
const { usdc, eth } = await sdk.balance.getBalances("0x...");
console.log(`${formatUnits(usdc, 6)} USDC, ${formatEther(eth)} ETH`);
```

## Builder Fee

Optionally configure a [builder fee](https://ostium-labs.gitbook.io/ostium-docs/developer/builder-codes) to earn a share of trading fees:

```typescript
const sdk = new OstiumSDK({
  network: "mainnet",
  privateKey: process.env.PRIVATE_KEY,
  rpcUrl: process.env.RPC_URL,
  builder: {
    address: "0x...",
    feePercent: 0.1, // 0.1%
  },
});
```

## Development

```bash
pnpm install
pnpm test              # Unit tests (143 tests)
pnpm test:coverage     # With coverage report
pnpm test:integration  # Live read-only tests (10 tests, price API + subgraph)
pnpm test:smoke        # Live trading on mainnet (13 tests, requires funded wallet)
pnpm lint              # Biome lint + format check
pnpm build             # ESM + type declarations
```

### Environment Variables

Integration and smoke tests require env vars — see [`.env.example`](./.env.example).

## Comparison with Python SDK

This SDK is a TypeScript rewrite of the [ostium-python-sdk](https://github.com/0xOstium/ostium-python-sdk), which served as the primary reference for all contract interactions and protocol behavior. The core trading flow is fully ported, with some design choices adapted for the TypeScript ecosystem:

- **Strong typing** — Full TypeScript interfaces for all params and responses
- **Exact approvals** — Per-trade USDC approval amounts
- **Read-only mode** — Subgraph and price queries work without a wallet
- **Stateless GraphQL** — Uses `graphql-request` for independent, stateless queries
- **Input validation** — Validates at the SDK boundary before hitting the chain
- **Consistent errors** — All failures wrapped in `OstiumError` with cause chain and suggestions

Check out the full comparison in [`DIFF.md`](./DIFF.md).

## Status

This is an early version (v0.1.0). The core trading flow is complete and tested, but some features from the Python SDK are intentionally deferred (formulae/PnL, delegation, balance, faucet).

## Issues

Found a bug or have a suggestion? [Open an issue](../../issues).

## Contributing

Contributions are not yet accepted — the project structure and API are still stabilizing. This section will be updated when contributions are welcome.
