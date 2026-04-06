import { formatUnits, keccak256, parseUnits, type TransactionReceipt, toBytes } from "viem";
import { OstiumError } from "./errors.js";
import type { TradeParams } from "./types.js";

export const toChainPrice = (price: number): bigint => parseUnits(String(price), 18);

export const fromChainPrice = (raw: bigint): string => formatUnits(raw, 18);

export const toChainCollateral = (amount: number): bigint => parseUnits(String(amount), 6);

export const fromChainCollateral = (raw: bigint): string => formatUnits(raw, 6);

export const toChainLeverage = (lev: number): bigint => parseUnits(String(lev), 2);

export const toChainSlippage = (slippage: number): bigint => parseUnits(String(slippage), 2);

export const toChainClosePercentage = (pct: number): bigint => parseUnits(String(pct), 2);

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function assertInteger(value: number, name: string, min: number, max: number): void {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new OstiumError(`Invalid ${name}: ${value}`, {
      suggestion: `${name} must be an integer between ${min} and ${max}`,
    });
  }
}

function assertPositive(value: number, name: string): void {
  if (typeof value !== "number" || Number.isNaN(value) || value <= 0) {
    throw new OstiumError(`Invalid ${name}: ${value}`, {
      suggestion: `${name} must be greater than 0`,
    });
  }
}

function assertNonNegative(value: number, name: string): void {
  if (typeof value !== "number" || Number.isNaN(value) || value < 0) {
    throw new OstiumError(`Invalid ${name}: ${value}`, {
      suggestion: `${name} must be 0 or greater`,
    });
  }
}

function assertCollateralAmount(value: number, name: string): void {
  assertPositive(value, name);
  try {
    if (toChainCollateral(value) === 0n) {
      throw new Error("Collateral amount truncates to zero");
    }
  } catch {
    throw new OstiumError(`Invalid ${name}: ${value}`, {
      suggestion: `${name} must be at least 0.000001 USDC (6-decimal precision)`,
    });
  }
}

export function validatePairIndex(pairIndex: number): void {
  assertInteger(pairIndex, "pairIndex", 0, 65535);
}

export function validateTradeIndex(index: number): void {
  assertInteger(index, "tradeIndex", 0, 255);
}

export function validateOrderIndex(index: number): void {
  assertInteger(index, "orderIndex", 0, 255);
}

export function validateOrderId(orderId: bigint | number | string): bigint {
  if (typeof orderId === "string" && orderId.trim() === "") {
    throw new OstiumError("Invalid orderId: empty string", {
      suggestion: "orderId must be a non-negative integer (number, bigint, or string)",
    });
  }
  if (typeof orderId === "number" && !Number.isSafeInteger(orderId)) {
    throw new OstiumError(`Invalid orderId: ${orderId}`, {
      suggestion: "orderId number must be a safe integer; use bigint or string for larger values",
    });
  }
  let parsed: bigint;
  try {
    parsed = BigInt(orderId);
  } catch {
    throw new OstiumError(`Invalid orderId: ${orderId}`, {
      suggestion: "orderId must be a non-negative integer (number, bigint, or string)",
    });
  }
  if (parsed < 0n) {
    throw new OstiumError(`Invalid orderId: ${orderId}`, {
      suggestion: "orderId must be 0 or greater",
    });
  }
  return parsed;
}

export function validateClosePercentage(pct: number): void {
  assertInteger(pct, "closePercentage", 1, 100);
}

export function validateCollateralAmount(amount: number): void {
  assertCollateralAmount(amount, "amount");
}

export function validatePrice(price: number): void {
  assertPositive(price, "price");
}

export function validateNonNegativePrice(price: number, name: string): void {
  assertNonNegative(price, name);
}

const VALID_DIRECTIONS = new Set(["long", "short"]);
const VALID_ORDER_TYPES = new Set(["market", "limit", "stop"]);

export function validateTradeParams(params: TradeParams): void {
  assertCollateralAmount(params.collateral, "collateral");
  assertPositive(params.leverage, "leverage");
  validatePairIndex(params.pairIndex);

  if (!VALID_DIRECTIONS.has(params.direction)) {
    throw new OstiumError(`Invalid direction: ${params.direction}`, {
      suggestion: "direction must be 'long' or 'short'",
    });
  }

  if (!VALID_ORDER_TYPES.has(params.orderType)) {
    throw new OstiumError(`Invalid orderType: ${params.orderType}`, {
      suggestion: "orderType must be 'market', 'limit', or 'stop'",
    });
  }

  if (params.tp !== undefined) assertNonNegative(params.tp, "tp");
  if (params.sl !== undefined) assertNonNegative(params.sl, "sl");
  if (params.slippage !== undefined) assertNonNegative(params.slippage, "slippage");
}

// ---------------------------------------------------------------------------
// Order ID extraction
// ---------------------------------------------------------------------------

const PRICE_REQUESTED_TOPIC = keccak256(toBytes("PriceRequested(uint256,bytes32,uint256)"));

export function extractOrderId(receipt: TransactionReceipt): string | undefined {
  const log = receipt.logs.find((l) => l.topics[0] === PRICE_REQUESTED_TOPIC);
  if (!log?.topics[1]) return undefined;
  return BigInt(log.topics[1]).toString();
}
