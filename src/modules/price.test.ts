import { beforeEach, describe, expect, it, vi } from "vitest";
import { OstiumError } from "../errors.js";
import type { PriceData } from "../types.js";
import { Price } from "./price.js";

const mockPrices: PriceData[] = [
  {
    feed_id: "0x00039d",
    bid: 107646.01,
    mid: 107646.03,
    ask: 107646.06,
    isMarketOpen: true,
    isDayTradingClosed: false,
    from: "BTC",
    to: "USD",
    timestampSeconds: 1748460056,
  },
  {
    feed_id: "0x00039e",
    bid: 3200.5,
    mid: 3200.55,
    ask: 3200.6,
    isMarketOpen: true,
    isDayTradingClosed: false,
    from: "ETH",
    to: "USD",
    timestampSeconds: 1748460056,
  },
];

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

beforeEach(() => {
  fetchMock.mockReset();
});

describe("Price", () => {
  const price = new Price();

  describe("getLatestPrices", () => {
    it("returns parsed price array", async () => {
      fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve(mockPrices) });

      const result = await price.getLatestPrices();
      expect(result).toEqual(mockPrices);
      expect(fetchMock).toHaveBeenCalledOnce();
    });

    it("throws OstiumError on non-OK response", async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 503, statusText: "Service Unavailable" });

      await expect(price.getLatestPrices()).rejects.toThrow(OstiumError);
      await expect(price.getLatestPrices()).rejects.toThrow("503");
    });
  });

  describe("getPrice", () => {
    it("returns matching pair", async () => {
      fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve(mockPrices) });

      const result = await price.getPrice("ETH", "USD");
      expect(result.mid).toBe(3200.55);
    });

    it("throws OstiumError when pair not found", async () => {
      fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve(mockPrices) });

      await expect(price.getPrice("DOGE", "USD")).rejects.toThrow(OstiumError);
      await expect(price.getPrice("DOGE", "USD")).rejects.toThrow("DOGE/USD");
    });
  });
});
