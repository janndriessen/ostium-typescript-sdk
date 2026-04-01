import type { Log, TransactionReceipt } from "viem";
import { describe, expect, it } from "vitest";
import { OstiumError } from "./errors.js";
import {
  extractOrderId,
  fromChainCollateral,
  fromChainPrice,
  toChainClosePercentage,
  toChainCollateral,
  toChainLeverage,
  toChainPrice,
  toChainSlippage,
  validateClosePercentage,
  validateOrderIndex,
  validatePairIndex,
  validatePrice,
  validateTradeIndex,
  validateTradeParams,
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

describe("validation", () => {
  describe("validatePairIndex", () => {
    it("accepts valid pair index", () => {
      expect(() => validatePairIndex(0)).not.toThrow();
      expect(() => validatePairIndex(65535)).not.toThrow();
    });

    it("rejects invalid pair index", () => {
      expect(() => validatePairIndex(-1)).toThrow(OstiumError);
      expect(() => validatePairIndex(65536)).toThrow(OstiumError);
      expect(() => validatePairIndex(1.5)).toThrow(OstiumError);
      expect(() => validatePairIndex(Number.NaN)).toThrow(OstiumError);
    });
  });

  describe("validateTradeIndex", () => {
    it("accepts valid trade index", () => {
      expect(() => validateTradeIndex(0)).not.toThrow();
      expect(() => validateTradeIndex(255)).not.toThrow();
    });

    it("rejects invalid trade index", () => {
      expect(() => validateTradeIndex(-1)).toThrow(OstiumError);
      expect(() => validateTradeIndex(256)).toThrow(OstiumError);
    });
  });

  describe("validateOrderIndex", () => {
    it("accepts valid order index", () => {
      expect(() => validateOrderIndex(0)).not.toThrow();
      expect(() => validateOrderIndex(255)).not.toThrow();
    });

    it("rejects invalid order index", () => {
      expect(() => validateOrderIndex(-1)).toThrow(OstiumError);
      expect(() => validateOrderIndex(256)).toThrow(OstiumError);
    });
  });

  describe("validateClosePercentage", () => {
    it("accepts valid percentages", () => {
      expect(() => validateClosePercentage(1)).not.toThrow();
      expect(() => validateClosePercentage(100)).not.toThrow();
    });

    it("rejects invalid percentages", () => {
      expect(() => validateClosePercentage(0)).toThrow(OstiumError);
      expect(() => validateClosePercentage(101)).toThrow(OstiumError);
    });
  });

  describe("validatePrice", () => {
    it("accepts positive prices", () => {
      expect(() => validatePrice(107646.03)).not.toThrow();
    });

    it("rejects non-positive prices", () => {
      expect(() => validatePrice(0)).toThrow(OstiumError);
      expect(() => validatePrice(-1)).toThrow(OstiumError);
      expect(() => validatePrice(Number.NaN)).toThrow(OstiumError);
    });
  });

  describe("validateTradeParams", () => {
    const validParams = {
      collateral: 100,
      leverage: 10,
      pairIndex: 0,
      direction: "long" as const,
      orderType: "market" as const,
    };

    it("accepts valid params", () => {
      expect(() => validateTradeParams(validParams)).not.toThrow();
    });

    it("accepts valid params with optional fields", () => {
      expect(() =>
        validateTradeParams({ ...validParams, tp: 110000, sl: 90000, slippage: 2 }),
      ).not.toThrow();
    });

    it("rejects zero collateral", () => {
      expect(() => validateTradeParams({ ...validParams, collateral: 0 })).toThrow(OstiumError);
    });

    it("rejects zero leverage", () => {
      expect(() => validateTradeParams({ ...validParams, leverage: 0 })).toThrow(OstiumError);
    });

    it("rejects invalid pairIndex", () => {
      expect(() => validateTradeParams({ ...validParams, pairIndex: -1 })).toThrow(OstiumError);
    });

    it("rejects negative tp", () => {
      expect(() => validateTradeParams({ ...validParams, tp: -1 })).toThrow(OstiumError);
    });

    it("rejects negative sl", () => {
      expect(() => validateTradeParams({ ...validParams, sl: -1 })).toThrow(OstiumError);
    });

    it("rejects negative slippage", () => {
      expect(() => validateTradeParams({ ...validParams, slippage: -1 })).toThrow(OstiumError);
    });

    it("allows zero tp and sl", () => {
      expect(() => validateTradeParams({ ...validParams, tp: 0, sl: 0 })).not.toThrow();
    });

    it("rejects invalid direction", () => {
      // biome-ignore lint/suspicious/noExplicitAny: testing runtime validation for JS consumers
      expect(() => validateTradeParams({ ...validParams, direction: "up" as any })).toThrow(
        OstiumError,
      );
    });

    it("rejects invalid orderType", () => {
      // biome-ignore lint/suspicious/noExplicitAny: testing runtime validation for JS consumers
      expect(() => validateTradeParams({ ...validParams, orderType: "MARKET" as any })).toThrow(
        OstiumError,
      );
    });
  });
});

describe("extractOrderId", () => {
  const PRICE_REQUESTED_TOPIC =
    "0x8195bed39a3fd3cf674a481e5c9ebcec05361cfca110f800bedda374c24bdeea";

  const mockReceipt = (logs: Partial<Log>[]) => ({ logs }) as TransactionReceipt;

  it("extracts orderId from PriceRequested log", () => {
    const orderId = 42n;
    const receipt = mockReceipt([
      {
        topics: [PRICE_REQUESTED_TOPIC, `0x${orderId.toString(16).padStart(64, "0")}`] as [
          `0x${string}`,
          ...`0x${string}`[],
        ],
      },
    ]);
    expect(extractOrderId(receipt)).toBe("42");
  });

  it("returns undefined when no matching log", () => {
    const receipt = mockReceipt([{ topics: ["0xdeadbeef"] as [`0x${string}`] }]);
    expect(extractOrderId(receipt)).toBeUndefined();
  });

  it("returns undefined for empty logs", () => {
    const receipt = mockReceipt([]);
    expect(extractOrderId(receipt)).toBeUndefined();
  });
});
