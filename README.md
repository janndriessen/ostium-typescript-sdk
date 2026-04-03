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

Omit `privateKey` to use the SDK without a wallet — price fetching and subgraph queries work without one.

```typescript
const sdk = new OstiumSDK({ network: "mainnet" });

const prices = await sdk.price.getLatestPrices();
const trades = await sdk.subgraph.getOpenTrades("0x...");
```

## Trading Methods

| Method                                                                        | Description                          |
| ----------------------------------------------------------------------------- | ------------------------------------ |
| `openTrade(params, atPrice)`                                                  | Open a market, limit, or stop trade  |
| `closeTrade(pairIndex, tradeIndex, marketPrice, closePercentage?, slippage?)` | Close all or part of a position      |
| `updateTp(pairIndex, tradeIndex, newTp)`                                      | Set/update take profit (0 to remove) |
| `updateSl(pairIndex, tradeIndex, newSl)`                                      | Set/update stop loss (0 to remove)   |
| `cancelLimitOrder(pairIndex, orderIndex)`                                     | Cancel a pending limit/stop order    |
| `updateLimitOrder(pairIndex, orderIndex, price?, tp?, sl?)`                   | Update an open limit order           |

All write methods return a typed `TransactionResult` with `transactionHash`, `receipt`, and optional `orderId`.

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
