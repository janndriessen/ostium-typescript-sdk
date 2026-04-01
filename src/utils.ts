import { formatUnits, parseUnits } from "viem";

export const toChainPrice = (price: number): bigint => parseUnits(String(price), 18);

export const fromChainPrice = (raw: bigint): string => formatUnits(raw, 18);

export const toChainCollateral = (amount: number): bigint => parseUnits(String(amount), 6);

export const fromChainCollateral = (raw: bigint): string => formatUnits(raw, 6);

export const toChainLeverage = (lev: number): bigint => parseUnits(String(lev), 2);

export const toChainSlippage = (slippage: number): bigint => parseUnits(String(slippage), 2);

export const toChainClosePercentage = (pct: number): bigint => parseUnits(String(pct), 2);
