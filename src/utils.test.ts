import { describe, expect, it } from "vitest";
import {
  fromChainCollateral,
  fromChainPrice,
  toChainClosePercentage,
  toChainCollateral,
  toChainLeverage,
  toChainPrice,
  toChainSlippage,
} from "./utils.js";

describe("scaling helpers", () => {
  describe("toChainPrice / fromChainPrice", () => {
    it("scales price to 18 decimals", () => {
      expect(toChainPrice(107646.03)).toBe(107646030000000000000000n);
    });

    it("handles zero", () => {
      expect(toChainPrice(0)).toBe(0n);
    });

    it("round-trips correctly", () => {
      const price = 3200.55;
      expect(fromChainPrice(toChainPrice(price))).toBe("3200.55");
    });

    it("formats from chain price", () => {
      expect(fromChainPrice(107646030000000000000000n)).toBe("107646.03");
    });
  });

  describe("toChainCollateral / fromChainCollateral", () => {
    it("scales USDC to 6 decimals", () => {
      expect(toChainCollateral(100)).toBe(100000000n);
    });

    it("handles fractional USDC", () => {
      expect(toChainCollateral(99.5)).toBe(99500000n);
    });

    it("round-trips correctly", () => {
      expect(fromChainCollateral(toChainCollateral(100))).toBe("100");
    });
  });

  describe("toChainLeverage", () => {
    it("scales leverage to 2 decimals", () => {
      expect(toChainLeverage(50)).toBe(5000n);
    });

    it("handles fractional leverage", () => {
      expect(toChainLeverage(2.5)).toBe(250n);
    });
  });

  describe("toChainSlippage", () => {
    it("scales slippage percentage to 2 decimals", () => {
      expect(toChainSlippage(2)).toBe(200n);
    });

    it("handles zero slippage", () => {
      expect(toChainSlippage(0)).toBe(0n);
    });
  });

  describe("toChainClosePercentage", () => {
    it("scales 100% to 10000 basis points", () => {
      expect(toChainClosePercentage(100)).toBe(10000n);
    });

    it("scales 50% to 5000 basis points", () => {
      expect(toChainClosePercentage(50)).toBe(5000n);
    });
  });
});
