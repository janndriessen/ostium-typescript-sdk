import { describe, expect, it } from "vitest";
import { OstiumError } from "../../src/errors.js";
import { Price } from "../../src/modules/price.js";

const enabled = process.env.INTEGRATION === "true";

describe.runIf(enabled)("Price (live)", { timeout: 15000 }, () => {
  const price = new Price();

  it("getLatestPrices returns non-empty array", async () => {
    const prices = await price.getLatestPrices();
    expect(prices.length).toBeGreaterThan(0);
  });

  it("each price has expected fields and types", async () => {
    const prices = await price.getLatestPrices();
    expect(prices.length).toBeGreaterThan(0);

    for (const p of prices) {
      expect(typeof p.feed_id).toBe("string");
      expect(typeof p.bid).toBe("number");
      expect(typeof p.mid).toBe("number");
      expect(typeof p.ask).toBe("number");
      expect(typeof p.from).toBe("string");
      expect(typeof p.to).toBe("string");
      expect(typeof p.isMarketOpen).toBe("boolean");
      expect(typeof p.isDayTradingClosed).toBe("boolean");
      expect(typeof p.timestampSeconds).toBe("number");
      expect(p.bid).toBeGreaterThan(0);
      expect(p.mid).toBeGreaterThan(0);
      expect(p.ask).toBeGreaterThan(0);
    }
  });

  it("getPrice returns BTC/USD", async () => {
    const btc = await price.getPrice("BTC", "USD");
    expect(btc.from).toBe("BTC");
    expect(btc.to).toBe("USD");
    expect(btc.mid).toBeGreaterThan(0);
  });

  it("getPrice throws for nonexistent pair", async () => {
    await expect(price.getPrice("NONEXISTENT", "PAIR")).rejects.toThrow(OstiumError);
  });
});
