import { beforeEach, describe, expect, it, vi } from "vitest";
import { OstiumError } from "../errors.js";
import type { HistoryOrder, OpenOrder, OpenTrade, Order, Pair, Trade } from "../types.js";
import { Subgraph } from "./subgraph.js";

const requestMock = vi.fn();

vi.mock("graphql-request", () => ({
  GraphQLClient: class {
    request = requestMock;
  },
  gql: (strings: TemplateStringsArray) => strings.join(""),
}));

beforeEach(() => {
  requestMock.mockReset();
});

const mockPair: Pair = {
  id: "0",
  from: "BTC",
  to: "USD",
  feed: "0x1234",
  overnightMaxLeverage: "100",
  longOI: "1000000",
  shortOI: "500000",
  maxOI: "10000000",
  makerFeeP: "100",
  takerFeeP: "200",
  makerMaxLeverage: "150",
  curFundingLong: "50",
  curFundingShort: "50",
  curRollover: "10",
  totalOpenTrades: "42",
  totalOpenLimitOrders: "5",
  accRollover: "100",
  lastRolloverBlock: "999999",
  rolloverFeePerBlock: "1",
  accFundingLong: "200",
  accFundingShort: "200",
  lastFundingBlock: "999998",
  maxFundingFeePerBlock: "10",
  lastFundingRate: "5",
  hillInflectionPoint: "500000",
  hillPosScale: "100",
  hillNegScale: "100",
  springFactor: "50",
  sFactorUpScaleP: "100",
  sFactorDownScaleP: "100",
  lastTradePrice: "107000000000000000000000",
  maxLeverage: "150",
  group: {
    id: "0",
    name: "crypto",
    minLeverage: "2",
    maxLeverage: "150",
    maxCollateralP: "100",
    longCollateral: "5000000",
    shortCollateral: "5000000",
  },
  fee: { minLevPos: "1500" },
};

const mockTrade: OpenTrade = {
  tradeID: "1",
  collateral: "100000000",
  leverage: "5000",
  highestLeverage: "5000",
  openPrice: "107000000000000000000000",
  stopLossPrice: "0",
  takeProfitPrice: "0",
  isOpen: true,
  timestamp: "1748460056",
  isBuy: true,
  notional: "500000000",
  tradeNotional: "500000000",
  funding: "0",
  rollover: "0",
  trader: "0xabc123",
  index: "0",
  pair: {
    id: "0",
    feed: "0x1234",
    from: "BTC",
    to: "USD",
    accRollover: "100",
    lastRolloverBlock: "999999",
    rolloverFeePerBlock: "1",
    accFundingLong: "200",
    spreadP: "10",
    accFundingShort: "200",
    longOI: "1000000",
    shortOI: "500000",
    maxOI: "10000000",
    maxLeverage: "150",
    hillInflectionPoint: "500000",
    hillPosScale: "100",
    hillNegScale: "100",
    springFactor: "50",
    sFactorUpScaleP: "100",
    sFactorDownScaleP: "100",
    lastFundingBlock: "999998",
    maxFundingFeePerBlock: "10",
    lastFundingRate: "5",
  },
};

const mockOrder: OpenOrder = {
  collateral: "100000000",
  leverage: "5000",
  isBuy: true,
  isActive: true,
  id: "0-0-1",
  openPrice: "107000000000000000000000",
  takeProfitPrice: "0",
  stopLossPrice: "0",
  trader: "0xabc123",
  initiatedAt: "1748460056",
  limitType: "1",
  pair: {
    id: "0",
    feed: "0x1234",
    from: "BTC",
    to: "USD",
    accRollover: "100",
    lastRolloverBlock: "999999",
    rolloverFeePerBlock: "1",
    accFundingLong: "200",
    spreadP: "10",
    accFundingShort: "200",
    longOI: "1000000",
    shortOI: "500000",
    lastFundingBlock: "999998",
    maxFundingFeePerBlock: "10",
    lastFundingRate: "5",
  },
};

describe("Subgraph", () => {
  const subgraph = new Subgraph("https://example.com/graphql");

  describe("getPairs", () => {
    it("returns typed pairs array", async () => {
      requestMock.mockResolvedValue({ pairs: [mockPair] });
      const result = await subgraph.getPairs();
      expect(result).toEqual([mockPair]);
    });
  });

  describe("getPairDetails", () => {
    it("converts pairIndex to string ID", async () => {
      requestMock.mockResolvedValue({ pair: mockPair });
      await subgraph.getPairDetails(0);
      expect(requestMock).toHaveBeenCalledWith(expect.any(String), { pair_id: "0" });
    });

    it("returns null when pair not found", async () => {
      requestMock.mockResolvedValue({ pair: null });
      const result = await subgraph.getPairDetails(999);
      expect(result).toBeNull();
    });

    it("rejects negative pairIndex", async () => {
      await expect(subgraph.getPairDetails(-1)).rejects.toThrow(OstiumError);
    });

    it("rejects non-integer pairIndex", async () => {
      await expect(subgraph.getPairDetails(1.5)).rejects.toThrow(OstiumError);
    });

    it("rejects NaN pairIndex", async () => {
      await expect(subgraph.getPairDetails(Number.NaN)).rejects.toThrow(OstiumError);
    });

    it("rejects pairIndex above uint16 max", async () => {
      await expect(subgraph.getPairDetails(65536)).rejects.toThrow(OstiumError);
    });
  });

  describe("getOpenTrades", () => {
    it("rejects invalid address", async () => {
      await expect(subgraph.getOpenTrades("not-an-address")).rejects.toThrow(OstiumError);
      expect(requestMock).not.toHaveBeenCalled();
    });

    it("returns typed trades array", async () => {
      requestMock.mockResolvedValue({ trades: [mockTrade] });
      const result = await subgraph.getOpenTrades("0xabc1230000000000000000000000000000000000");
      expect(result).toEqual([mockTrade]);
      expect(requestMock).toHaveBeenCalledWith(expect.any(String), {
        trader: "0xabc1230000000000000000000000000000000000",
      });
    });
  });

  describe("getOrders", () => {
    it("rejects invalid address", async () => {
      await expect(subgraph.getOrders("not-an-address")).rejects.toThrow(OstiumError);
      expect(requestMock).not.toHaveBeenCalled();
    });

    it("returns typed orders array", async () => {
      requestMock.mockResolvedValue({ limits: [mockOrder] });
      const result = await subgraph.getOrders("0xabc1230000000000000000000000000000000000");
      expect(result).toEqual([mockOrder]);
    });
  });

  describe("getRecentHistory", () => {
    const mockHistoryOrder: HistoryOrder = {
      id: "42",
      isBuy: true,
      trader: "0xabc123",
      notional: "500000000",
      tradeNotional: "500000000",
      collateral: "100000000",
      leverage: "5000",
      orderType: "0",
      orderAction: "Open",
      price: "107000000000000000000000",
      initiatedAt: "1748460056",
      executedAt: "1748460060",
      executedTx: "0xexec",
      isCancelled: false,
      cancelReason: null,
      profitPercent: "0",
      totalProfitPercent: "0",
      isPending: false,
      amountSentToTrader: "0",
      rolloverFee: "0",
      fundingFee: "0",
      pair: {
        id: "0",
        from: "BTC",
        to: "USD",
        feed: "0x1234",
        longOI: "1000000",
        shortOI: "500000",
        group: { name: "crypto" },
      },
    };

    it("rejects invalid address", async () => {
      await expect(subgraph.getRecentHistory("not-an-address")).rejects.toThrow(OstiumError);
      expect(requestMock).not.toHaveBeenCalled();
    });

    it("returns history orders", async () => {
      requestMock.mockResolvedValue({ orders: [mockHistoryOrder] });
      const result = await subgraph.getRecentHistory("0xabc1230000000000000000000000000000000000");
      expect(result).toEqual([mockHistoryOrder]);
    });

    it("passes count parameter", async () => {
      requestMock.mockResolvedValue({ orders: [] });
      await subgraph.getRecentHistory("0xabc1230000000000000000000000000000000000", 5);
      expect(requestMock).toHaveBeenCalledWith(expect.any(String), {
        trader: "0xabc1230000000000000000000000000000000000",
        last_n_orders: 5,
      });
    });

    it("defaults to 10 orders", async () => {
      requestMock.mockResolvedValue({ orders: [] });
      await subgraph.getRecentHistory("0xabc1230000000000000000000000000000000000");
      expect(requestMock).toHaveBeenCalledWith(expect.any(String), {
        trader: "0xabc1230000000000000000000000000000000000",
        last_n_orders: 10,
      });
    });
  });

  describe("getLiqMarginThresholdP", () => {
    it("returns threshold value", async () => {
      requestMock.mockResolvedValue({ metaDatas: [{ liqMarginThresholdP: "90" }] });
      const result = await subgraph.getLiqMarginThresholdP();
      expect(result).toBe("90");
    });

    it("throws OstiumError when metaDatas is empty", async () => {
      requestMock.mockResolvedValue({ metaDatas: [] });
      await expect(subgraph.getLiqMarginThresholdP()).rejects.toThrow(OstiumError);
    });
  });

  describe("getPairMaxLeverage", () => {
    it("returns group maxLeverage when set", async () => {
      requestMock.mockResolvedValue({
        pair: {
          ...mockPair,
          maxLeverage: "15000",
          group: { ...mockPair.group, maxLeverage: "10000" },
        },
      });
      const result = await subgraph.getPairMaxLeverage(0);
      expect(result).toBe(100);
    });

    it("falls back to pair maxLeverage when group is zero", async () => {
      requestMock.mockResolvedValue({
        pair: { ...mockPair, maxLeverage: "15000", group: { ...mockPair.group, maxLeverage: "0" } },
      });
      const result = await subgraph.getPairMaxLeverage(0);
      expect(result).toBe(150);
    });

    it("returns null when pair not found", async () => {
      requestMock.mockResolvedValue({ pair: null });
      const result = await subgraph.getPairMaxLeverage(999);
      expect(result).toBeNull();
    });
  });

  describe("getPairOvernightMaxLeverage", () => {
    it("returns overnight leverage when set", async () => {
      requestMock.mockResolvedValue({
        pair: { ...mockPair, overnightMaxLeverage: "5000" },
      });
      const result = await subgraph.getPairOvernightMaxLeverage(0);
      expect(result).toBe(50);
    });

    it("returns null when overnight leverage is zero", async () => {
      requestMock.mockResolvedValue({
        pair: { ...mockPair, overnightMaxLeverage: "0" },
      });
      const result = await subgraph.getPairOvernightMaxLeverage(0);
      expect(result).toBeNull();
    });

    it("returns null when pair not found", async () => {
      requestMock.mockResolvedValue({ pair: null });
      const result = await subgraph.getPairOvernightMaxLeverage(999);
      expect(result).toBeNull();
    });
  });

  describe("getOrderById", () => {
    const mockOrderEntity: Order = {
      id: "42",
      trader: "0xabc123",
      pair: { id: "0", from: "BTC", to: "USD", feed: "0x1234" },
      tradeID: "100",
      limitID: "0",
      orderType: "0",
      orderAction: "Open",
      price: "107000000000000000000000",
      priceAfterImpact: "107000000000000000000000",
      priceImpactP: "0",
      collateral: "100000000",
      notional: "500000000",
      tradeNotional: "500000000",
      profitPercent: "0",
      totalProfitPercent: "0",
      amountSentToTrader: "0",
      isBuy: true,
      initiatedAt: "1748460056",
      executedAt: "1748460060",
      initiatedTx: "0xinit",
      executedTx: "0xexec",
      initiatedBlock: "100000",
      executedBlock: "100001",
      leverage: "5000",
      isPending: false,
      isCancelled: false,
      cancelReason: null,
      devFee: "100000",
      vaultFee: "200000",
      oracleFee: "50000",
      liquidationFee: "0",
      fundingFee: "0",
      rolloverFee: "0",
      closePercent: "0",
    };

    it("returns order when found", async () => {
      requestMock.mockResolvedValue({ orders: [mockOrderEntity] });
      const result = await subgraph.getOrderById("42");
      expect(result).toEqual(mockOrderEntity);
      expect(requestMock).toHaveBeenCalledWith(expect.any(String), { order_id: "42" });
    });

    it("returns null when not found", async () => {
      requestMock.mockResolvedValue({ orders: [] });
      const result = await subgraph.getOrderById("999");
      expect(result).toBeNull();
    });

    it("rejects empty string", async () => {
      await expect(subgraph.getOrderById("")).rejects.toThrow(OstiumError);
      expect(requestMock).not.toHaveBeenCalled();
    });

    it("rejects whitespace-only string", async () => {
      await expect(subgraph.getOrderById("   ")).rejects.toThrow(OstiumError);
      expect(requestMock).not.toHaveBeenCalled();
    });
  });

  describe("getTradeById", () => {
    const mockTradeEntity: Trade = {
      id: "100",
      trader: "0xabc123",
      pair: { id: "0", from: "BTC", to: "USD", feed: "0x1234" },
      index: "0",
      tradeID: "100",
      tradeType: "0",
      openPrice: "107000000000000000000000",
      closePrice: "0",
      takeProfitPrice: "0",
      stopLossPrice: "0",
      collateral: "100000000",
      notional: "500000000",
      tradeNotional: "500000000",
      highestLeverage: "5000",
      leverage: "5000",
      isBuy: true,
      isOpen: true,
      closeInitiated: false,
      funding: "0",
      rollover: "0",
      timestamp: "1748460060",
    };

    it("returns trade when found", async () => {
      requestMock.mockResolvedValue({ trades: [mockTradeEntity] });
      const result = await subgraph.getTradeById("100");
      expect(result).toEqual(mockTradeEntity);
      expect(requestMock).toHaveBeenCalledWith(expect.any(String), { trade_id: "100" });
    });

    it("returns null when not found", async () => {
      requestMock.mockResolvedValue({ trades: [] });
      const result = await subgraph.getTradeById("999");
      expect(result).toBeNull();
    });

    it("rejects empty string", async () => {
      await expect(subgraph.getTradeById("")).rejects.toThrow(OstiumError);
      expect(requestMock).not.toHaveBeenCalled();
    });
  });

  describe("trackOrder", () => {
    const fulfilledOrder: Order = {
      id: "42",
      trader: "0xabc123",
      pair: { id: "0", from: "BTC", to: "USD", feed: "0x1234" },
      tradeID: "100",
      limitID: "0",
      orderType: "0",
      orderAction: "Open",
      price: "107000000000000000000000",
      priceAfterImpact: "107000000000000000000000",
      priceImpactP: "0",
      collateral: "100000000",
      notional: "500000000",
      tradeNotional: "500000000",
      profitPercent: "0",
      totalProfitPercent: "0",
      amountSentToTrader: "0",
      isBuy: true,
      initiatedAt: "1748460056",
      executedAt: "1748460060",
      initiatedTx: "0xinit",
      executedTx: "0xexec",
      initiatedBlock: "100000",
      executedBlock: "100001",
      leverage: "5000",
      isPending: false,
      isCancelled: false,
      cancelReason: null,
      devFee: "100000",
      vaultFee: "200000",
      oracleFee: "50000",
      liquidationFee: "0",
      fundingFee: "0",
      rolloverFee: "0",
      closePercent: "0",
    };

    const pendingOrder: Order = {
      ...fulfilledOrder,
      isPending: true,
      executedAt: "0",
      executedTx: "",
      executedBlock: "0",
    };

    const cancelledOrder: Order = {
      ...fulfilledOrder,
      isPending: false,
      isCancelled: true,
      cancelReason: "TIMEOUT",
    };

    const tradeEntity: Trade = {
      id: "100",
      trader: "0xabc123",
      pair: { id: "0", from: "BTC", to: "USD", feed: "0x1234" },
      index: "0",
      tradeID: "100",
      tradeType: "0",
      openPrice: "107000000000000000000000",
      closePrice: "0",
      takeProfitPrice: "0",
      stopLossPrice: "0",
      collateral: "100000000",
      notional: "500000000",
      tradeNotional: "500000000",
      highestLeverage: "5000",
      leverage: "5000",
      isBuy: true,
      isOpen: true,
      closeInitiated: false,
      funding: "0",
      rollover: "0",
      timestamp: "1748460060",
    };

    it("returns order + trade when order fills immediately", async () => {
      requestMock
        .mockResolvedValueOnce({ orders: [fulfilledOrder] })
        .mockResolvedValueOnce({ trades: [tradeEntity] });

      const result = await subgraph.trackOrder("42", { intervalMs: 0, maxAttempts: 5 });

      expect(result.order).toEqual(fulfilledOrder);
      expect(result.trade).toEqual(tradeEntity);
    });

    it("returns order + null trade when cancelled", async () => {
      requestMock.mockResolvedValueOnce({ orders: [cancelledOrder] });

      const result = await subgraph.trackOrder("42", { intervalMs: 0, maxAttempts: 5 });

      expect(result.order).toEqual(cancelledOrder);
      expect(result.trade).toBeNull();
    });

    it("retries when order is pending then resolves", async () => {
      requestMock
        .mockResolvedValueOnce({ orders: [pendingOrder] })
        .mockResolvedValueOnce({ orders: [fulfilledOrder] })
        .mockResolvedValueOnce({ trades: [tradeEntity] });

      const result = await subgraph.trackOrder("42", { intervalMs: 0, maxAttempts: 5 });

      expect(result.order).toEqual(fulfilledOrder);
      expect(result.trade).toEqual(tradeEntity);
      expect(requestMock).toHaveBeenCalledTimes(3);
    });

    it("retries when order is not indexed yet", async () => {
      requestMock
        .mockResolvedValueOnce({ orders: [] })
        .mockResolvedValueOnce({ orders: [fulfilledOrder] })
        .mockResolvedValueOnce({ trades: [tradeEntity] });

      const result = await subgraph.trackOrder("42", { intervalMs: 0, maxAttempts: 5 });

      expect(result.order).toEqual(fulfilledOrder);
      expect(result.trade).toEqual(tradeEntity);
      expect(requestMock).toHaveBeenCalledTimes(3);
    });

    it("retries when trade is not indexed yet", async () => {
      requestMock
        .mockResolvedValueOnce({ orders: [fulfilledOrder] })
        .mockResolvedValueOnce({ trades: [] })
        .mockResolvedValueOnce({ orders: [fulfilledOrder] })
        .mockResolvedValueOnce({ trades: [tradeEntity] });

      const result = await subgraph.trackOrder("42", { intervalMs: 0, maxAttempts: 5 });

      expect(result.order).toEqual(fulfilledOrder);
      expect(result.trade).toEqual(tradeEntity);
      expect(requestMock).toHaveBeenCalledTimes(4);
    });

    it("handles partial close (trade stays open)", async () => {
      const closeOrder: Order = { ...fulfilledOrder, orderAction: "Close", closePercent: "5000" };
      const openTrade: Trade = { ...tradeEntity, isOpen: true };

      requestMock
        .mockResolvedValueOnce({ orders: [closeOrder] })
        .mockResolvedValueOnce({ trades: [openTrade] });

      const result = await subgraph.trackOrder("42", { intervalMs: 0, maxAttempts: 5 });

      expect(result.order).toEqual(closeOrder);
      expect(result.trade).toEqual(openTrade);
      expect(result.trade?.isOpen).toBe(true);
    });

    it("handles full close (trade is closed)", async () => {
      const closeOrder: Order = { ...fulfilledOrder, orderAction: "Close", closePercent: "10000" };
      const closedTrade: Trade = { ...tradeEntity, isOpen: false };

      requestMock
        .mockResolvedValueOnce({ orders: [closeOrder] })
        .mockResolvedValueOnce({ trades: [closedTrade] });

      const result = await subgraph.trackOrder("42", { intervalMs: 0, maxAttempts: 5 });

      expect(result.order).toEqual(closeOrder);
      expect(result.trade?.isOpen).toBe(false);
    });

    it("throws OstiumError after max attempts", async () => {
      requestMock.mockResolvedValue({ orders: [pendingOrder] });

      await expect(subgraph.trackOrder("42", { intervalMs: 0, maxAttempts: 3 })).rejects.toThrow(
        OstiumError,
      );
      expect(requestMock).toHaveBeenCalledTimes(3);
    });

    it("does not sleep after final attempt", async () => {
      vi.useFakeTimers();
      requestMock.mockResolvedValue({ orders: [pendingOrder] });

      const promise = subgraph.trackOrder("42", { intervalMs: 500, maxAttempts: 1 });
      const result = await promise.catch((e: unknown) => e);

      expect(result).toBeInstanceOf(OstiumError);
      // With maxAttempts=1, should not have scheduled any timers
      expect(vi.getTimerCount()).toBe(0);
      vi.useRealTimers();
    });
  });

  describe("error handling", () => {
    it("wraps GraphQL errors in OstiumError with original message", async () => {
      requestMock.mockRejectedValue(new Error("network error"));
      await expect(subgraph.getPairs()).rejects.toThrow(OstiumError);
      await expect(subgraph.getPairs()).rejects.toThrow("Subgraph query failed: network error");
    });
  });
});
