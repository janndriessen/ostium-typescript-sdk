import { beforeEach, describe, expect, it, vi } from "vitest";
import { OstiumError } from "../errors.js";
import type { OpenOrder, OpenTrade, Pair } from "../types.js";
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
    it("returns typed trades array", async () => {
      requestMock.mockResolvedValue({ trades: [mockTrade] });
      const result = await subgraph.getOpenTrades("0xabc123");
      expect(result).toEqual([mockTrade]);
      expect(requestMock).toHaveBeenCalledWith(expect.any(String), { trader: "0xabc123" });
    });
  });

  describe("getOrders", () => {
    it("returns typed orders array", async () => {
      requestMock.mockResolvedValue({ limits: [mockOrder] });
      const result = await subgraph.getOrders("0xabc123");
      expect(result).toEqual([mockOrder]);
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
