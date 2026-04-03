import { describe, expect, it } from "vitest";
import { mainnetConfig } from "../../src/config.js";
import { Subgraph } from "../../src/modules/subgraph.js";

const enabled = process.env.INTEGRATION === "true";

describe.runIf(enabled)("Subgraph (live)", { timeout: 15000 }, () => {
  const subgraph = new Subgraph(mainnetConfig.graphUrl);

  describe("getPairs", () => {
    it("returns non-empty array", async () => {
      const pairs = await subgraph.getPairs();
      expect(pairs.length).toBeGreaterThan(0);
    });

    it("pairs have expected structure", async () => {
      const pairs = await subgraph.getPairs();
      expect(pairs.length).toBeGreaterThan(0);
      const pair = pairs[0];

      expect(typeof pair.id).toBe("string");
      expect(typeof pair.from).toBe("string");
      expect(typeof pair.to).toBe("string");
      expect(typeof pair.feed).toBe("string");
      expect(typeof pair.maxLeverage).toBe("string");
      expect(typeof pair.longOI).toBe("string");
      expect(typeof pair.shortOI).toBe("string");

      expect(pair.group).toBeDefined();
      expect(typeof pair.group.id).toBe("string");
      expect(typeof pair.group.name).toBe("string");

      expect(pair.fee).toBeDefined();
      expect(typeof pair.fee.minLevPos).toBe("string");
    });
  });

  describe("getPairDetails", () => {
    it("returns BTC/USD for pairIndex 0", async () => {
      const pair = await subgraph.getPairDetails(0);
      expect(pair).not.toBeNull();
      expect(pair?.from).toBe("BTC");
      expect(pair?.to).toBe("USD");
    });

    it("returns null for nonexistent pair", async () => {
      const pair = await subgraph.getPairDetails(65535);
      expect(pair).toBeNull();
    });
  });

  describe("getOpenTrades", () => {
    it("returns array for a valid address", async () => {
      const trades = await subgraph.getOpenTrades("0x0000000000000000000000000000000000000000");
      expect(Array.isArray(trades)).toBe(true);
    });
  });

  describe("getOrders", () => {
    it("returns array for a valid address", async () => {
      const orders = await subgraph.getOrders("0x0000000000000000000000000000000000000000");
      expect(Array.isArray(orders)).toBe(true);
    });
  });
});
