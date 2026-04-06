# TypeScript SDK vs Python SDK — Comparison

This TypeScript SDK is a rewrite of the [ostium-python-sdk](https://github.com/0xOstium/ostium-python-sdk), focused on the core trading flow. The Python SDK served as the primary reference for contract interactions, subgraph queries, and protocol behavior.

---

## Core Trading Flow

All core trading operations are ported from the Python SDK:

| Python SDK | TypeScript SDK | Notes |
|---|---|---|
| `perform_trade(trade_params, at_price)` | `openTrade(params, atPrice)` | Same flow: approve, build struct, send, extract orderId |
| `close_trade(pair_id, trade_index, market_price, close_percentage)` | `closeTrade(pairIndex, tradeIndex, marketPrice, closePercentage?)` | Same params, same close percentage scaling |
| `update_tp(pair_id, trade_index, tp_price)` | `updateTp(pairIndex, tradeIndex, newTp)` | Identical |
| `update_sl(pairID, index, sl)` | `updateSl(pairIndex, tradeIndex, newSl)` | Identical |
| `add_collateral(pairID, index, collateral)` | `addCollateral(pairIndex, tradeIndex, amount)` | Same flow; TS calls `topUpCollateral` onchain |
| `remove_collateral(pair_id, trade_index, remove_amount)` | `removeCollateral(pairIndex, tradeIndex, amount)` | Async (oracle); extracts orderId from PriceRequested |
| `cancel_limit_order(pair_id, trade_index)` | `cancelLimitOrder(pairIndex, orderIndex)` | Identical |
| `update_limit_order(pair_id, index, pvt_key, price?, tp?, sl?)` | `updateLimitOrder(pairIndex, orderIndex, price?, tp?, sl?)` | Both read existing order, merge unchanged fields |
| `open_market_timeout(order_id)` | `openTradeMarketTimeout(orderId)` | Cancels a timed-out pending open and refunds collateral |
| `close_market_timeout(order_id, retry)` | `closeTradeMarketTimeout(orderId, retry?)` | Retry or cancel a timed-out pending close |
| `get_pairs()` | `getPairs()` | Identical query |
| `get_pair_details(pair_id)` | `getPairDetails(pairIndex)` | Identical query |
| `get_open_trades(address)` | `getOpenTrades(address)` | Identical query |
| `get_orders(trader)` | `getOrders(address)` | Identical query |
| `get_order_by_id(order_id)` | `getOrderById(orderId)` | Identical query |
| `get_trade_by_id(trade_id)` | `getTradeById(tradeId)` | Identical query |
| `track_order_and_trade(subgraph_client, order_id)` | `trackOrder(orderId, options?)` | Lives on Subgraph (not Trading); supports partial closes |
| `get_latest_prices()` / `get_price()` | `getLatestPrices()` / `getPrice(from, to)` | Same endpoint, same response shape |
| `balance.get_usdc_balance(address)` | `balance.getUsdc(address)` | Raw 6-decimal bigint; no cache |
| `balance.get_ether_balance(address)` | `balance.getEth(address)` | Native ETH balance in wei |
| `balance.get_balance(address, refresh?)` | `balance.getBalances(address)` | Both balances; TS version is always parallel via `Promise.all` |
| Network config (mainnet/testnet) | `mainnetConfig` / `testnetConfig` | Same addresses, same chain IDs |
| BuilderFee struct | `BuilderFee` interface | Same struct |
| PriceRequested event parsing | `extractOrderId(receipt)` | Same approach (keccak topic match) |

---

## Not Yet Ported (v1 scope)

These Python SDK features are not included in v1. They can be added in future versions as needed.

### Delegation (~150 LOC)

Every Python write method supports a `use_delegation` / `trader_address` branch for delegated trading. This adds branching to every method and is a more advanced use case.

### Withdraw (~30 LOC)

- `withdraw(amount, receiving_address)` — USDC transfer

### Formulae / PnL (~500+ LOC + Rust bindings)

- `formulae.py`, `formulae_wrapper.py`, `scscript/` — compiled Rust modules for funding rate math
- `get_open_trade_metrics()` — computes funding fee, rollover fee, unrealized PnL
- `get_funding_rate_for_pair_id()` — funding rate via Hill function
- Various rate calculation helpers

The most complex module in the Python SDK, with compiled Rust dependencies for precision math.

### Convenience Wrappers

- `get_formatted_pairs_details()` (~60 LOC) — formatted pair listing with live price enrichment
- `get_pair_max_leverage()` / `get_pair_overnight_max_leverage()` (~30 LOC) — wrappers over subgraph data

### Additional Subgraph Queries

- `get_recent_history(trader, last_n_orders)` — order history
- `get_order_by_id(order_id)` / `get_trade_by_id(trade_id)` — single-entity lookups
- `get_liq_margin_threshold_p()` — liquidation threshold (used by PnL calcs)

### Other Modules

- **Faucet** — testnet USDC faucet

---

## Design Differences

Different language, different ecosystem — some choices were adapted for TypeScript idioms and tooling.

| Area | Python SDK | TypeScript SDK | Rationale |
|---|---|---|---|
| USDC approval | Approves a generous fixed amount | Exact-amount approval per trade | Minimizes token exposure; extra tx is cheap on Arbitrum |
| Constructor | Connects to RPC + validates chain ID on init | No side effects; lazy `connect()` | Enables full read-only mode (subgraph, price, and RPC/contract reads without a wallet) |
| Error handling | Custom error code map (`fromErrorCodeToMessage`) | viem's built-in ABI error decoding | Leverages viem's native capabilities |
| Typing | Dynamic dicts for params and responses | Full TypeScript interfaces | Main value-add of a TS rewrite |
| Direction | `buy: true/false` | `direction: 'long' \| 'short'` | More explicit at the API surface |
| Order type | Numeric enum `0/1/2` | `'market' \| 'limit' \| 'stop'` | More explicit at the API surface |
| Pair identifier | Various names (`asset_type`, `pair_id`, `pairID`, `pairIndex`) | Always `pairIndex: number` | Consistent naming |
| GraphQL client | `gql` with `AIOHTTPTransport`, connection management | `graphql-request` (stateless) | Simpler — each request is independent |
| SSL | Custom SSL context handling | Native `fetch` defaults | Node.js handles SSL out of the box |
| Precision | Python `Decimal` + `PRECISION_*` constants | `bigint` + viem `parseUnits`/`formatUnits` | Idiomatic for the JS/TS ecosystem |
| Logging | `print()` with `verbose` flag | `Logger` interface (injectable) | Composable with any logging framework |
| Balance caching | 5-minute internal cache with `refresh=True` override | Stateless; cache at application layer if needed | Matches the rest of the SDK's stateless style |

---

## By the Numbers

| Metric | Value |
|---|---|
| Python SDK public methods | ~35 across all modules |
| TypeScript SDK public methods | ~22 (8 trading + 7 subgraph + 3 balance + 2 price + client + connect) |
| Core trading flow coverage | **100%** |
| Python API surface ported | **~63%** by method count |
| Features deferred | ~850+ lines equivalent |
| New in TypeScript | Strong typing, input validation, read-only mode, injectable logger |
