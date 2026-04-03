import { describe, expect, it } from "vitest";
import { OstiumSDK } from "../../src/client.js";
import type { TransactionResult } from "../../src/types.js";

const enabled = process.env.SMOKE === "true";
const privateKey = process.env.SMOKE_PRIVATE_KEY;
const rpcUrl = process.env.SMOKE_RPC_URL;

describe.runIf(enabled)("Trading smoke (mainnet)", () => {
  const sdk = new OstiumSDK({
    network: "mainnet",
    privateKey,
    rpcUrl,
  });

  // Shared state across sequential tests
  let btcPairIndex: number;
  let btcPrice: number;
  let tradeIndex: number;
  let openTradeResult: TransactionResult;

  it("connects to Arbitrum One", async () => {
    await sdk.connect();
  });

  it("fetches BTC/USD price", async () => {
    const priceData = await sdk.price.getPrice("BTC", "USD");
    expect(priceData.isMarketOpen).toBe(true);
    btcPrice = priceData.mid;
    expect(btcPrice).toBeGreaterThan(0);
  });

  it("resolves BTC pair index from subgraph", async () => {
    const pairs = await sdk.subgraph.getPairs();
    const btc = pairs.find((p) => p.from === "BTC" && p.to === "USD");
    expect(btc).toBeDefined();
    btcPairIndex = Number(btc?.id);
  });

  it("opens a market long trade", async () => {
    // $5 × 2x = $10 leveraged position (min is $4.50 per minLevPos)
    openTradeResult = await sdk.trading.openTrade(
      {
        collateral: 5,
        leverage: 2,
        pairIndex: btcPairIndex,
        direction: "long",
        orderType: "market",
      },
      btcPrice,
    );

    expect(openTradeResult.transactionHash).toBeTruthy();
    expect(openTradeResult.receipt).toBeDefined();
    expect(openTradeResult.orderId).toBeDefined();
  });

  it("verifies trade via subgraph", async () => {
    const traderAddress = openTradeResult.receipt.from;

    // Poll subgraph — indexing can take 10-30 seconds
    let attempts = 0;
    while (attempts < 6) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      const trades = await sdk.subgraph.getOpenTrades(traderAddress);
      const ourTrade = trades.find((t) => t.pair.id === String(btcPairIndex) && t.isBuy === true);
      if (ourTrade) {
        tradeIndex = Number(ourTrade.index);
        return;
      }
      attempts++;
    }
    expect.fail("Trade not found in subgraph after 30 seconds");
  });

  it("updates take profit", async () => {
    const tp = btcPrice * 1.1; // 10% above entry
    const result = await sdk.trading.updateTp(btcPairIndex, tradeIndex, tp);
    expect(result.transactionHash).toBeTruthy();
  });

  it("updates stop loss", async () => {
    const sl = btcPrice * 0.9; // 10% below entry
    const result = await sdk.trading.updateSl(btcPairIndex, tradeIndex, sl);
    expect(result.transactionHash).toBeTruthy();
  });

  it("closes the trade", async () => {
    const freshPrice = await sdk.price.getPrice("BTC", "USD");
    const result = await sdk.trading.closeTrade(btcPairIndex, tradeIndex, freshPrice.mid);
    expect(result.transactionHash).toBeTruthy();
    expect(result.orderId).toBeDefined();
  });
});

describe.runIf(enabled)("Limit order smoke (mainnet)", () => {
  const sdk = new OstiumSDK({
    network: "mainnet",
    privateKey,
    rpcUrl,
  });

  let btcPairIndex: number;
  let btcPrice: number;
  let orderIndex: number;
  let openOrderResult: TransactionResult;

  it("fetches BTC/USD price and pair index", async () => {
    const priceData = await sdk.price.getPrice("BTC", "USD");
    btcPrice = priceData.mid;

    const pairs = await sdk.subgraph.getPairs();
    const btc = pairs.find((p) => p.from === "BTC" && p.to === "USD");
    btcPairIndex = Number(btc?.id);
  });

  it("opens a limit order well below market", async () => {
    // $5 × 2x = $10 leveraged position, price at 50% below market so it won't fill
    const limitPrice = btcPrice * 0.5;
    openOrderResult = await sdk.trading.openTrade(
      {
        collateral: 5,
        leverage: 2,
        pairIndex: btcPairIndex,
        direction: "long",
        orderType: "limit",
        tp: btcPrice * 0.6,
        sl: btcPrice * 0.4,
      },
      limitPrice,
    );

    expect(openOrderResult.transactionHash).toBeTruthy();
    // Limit orders don't emit PriceRequested — no orderId expected
  });

  it("verifies order via subgraph", async () => {
    const traderAddress = openOrderResult.receipt.from;

    // Poll subgraph — indexing can take 10-30 seconds
    let attempts = 0;
    while (attempts < 6) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      const orders = await sdk.subgraph.getOrders(traderAddress);
      const ourOrder = orders.find((o) => o.pair.id === String(btcPairIndex) && o.isBuy === true);
      if (ourOrder) {
        // ID format: {trader}_{pairIndex}_{orderIndex}
        orderIndex = Number(ourOrder.id.split("_").pop());
        return;
      }
      attempts++;
    }
    expect.fail("Order not found in subgraph after 30 seconds");
  });

  it("updates limit order price", async () => {
    const newPrice = btcPrice * 0.45;
    const result = await sdk.trading.updateLimitOrder(btcPairIndex, orderIndex, newPrice);
    expect(result.transactionHash).toBeTruthy();
  });

  it("cancels limit order", async () => {
    const result = await sdk.trading.cancelLimitOrder(btcPairIndex, orderIndex);
    expect(result.transactionHash).toBeTruthy();
  });
});
