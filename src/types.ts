import type { Address, TransactionReceipt } from "viem";

export interface Logger {
  debug: (msg: string) => void;
  info: (msg: string) => void;
  warn: (msg: string) => void;
  error: (msg: string) => void;
}

export interface NetworkConfig {
  chainId: number;
  graphUrl: string;
  contracts: {
    usdc: Address;
    trading: Address;
    tradingStorage: Address;
  };
}

export interface BuilderConfig {
  address: Address;
  feePercent: number;
}

export interface OstiumSDKConfig {
  network: "mainnet" | "testnet";
  privateKey?: string;
  rpcUrl?: string;
  logger?: Logger;
  builder?: BuilderConfig;
}

// ---------------------------------------------------------------------------
// Trading inputs / outputs
// ---------------------------------------------------------------------------

export interface TradeParams {
  collateral: number;
  leverage: number;
  pairIndex: number;
  direction: "long" | "short";
  orderType: "market" | "limit" | "stop";
  tp?: number;
  sl?: number;
  slippage?: number;
}

export interface TransactionResult {
  transactionHash: string;
  receipt: TransactionReceipt;
  orderId?: string;
}

export interface BuilderFee {
  builder: Address;
  builderFee: bigint;
}

// ---------------------------------------------------------------------------
// Subgraph response types — all onchain numerics are strings
// ---------------------------------------------------------------------------

export interface PairGroup {
  id: string;
  name: string;
  minLeverage: string;
  maxLeverage: string;
  maxCollateralP: string;
  longCollateral: string;
  shortCollateral: string;
}

export interface PairFee {
  minLevPos: string;
}

export interface Pair {
  id: string;
  from: string;
  to: string;
  feed: string;
  overnightMaxLeverage: string;
  longOI: string;
  shortOI: string;
  maxOI: string;
  makerFeeP: string;
  takerFeeP: string;
  makerMaxLeverage: string;
  curFundingLong: string;
  curFundingShort: string;
  curRollover: string;
  totalOpenTrades: string;
  totalOpenLimitOrders: string;
  accRollover: string;
  lastRolloverBlock: string;
  rolloverFeePerBlock: string;
  accFundingLong: string;
  accFundingShort: string;
  lastFundingBlock: string;
  maxFundingFeePerBlock: string;
  lastFundingRate: string;
  hillInflectionPoint: string;
  hillPosScale: string;
  hillNegScale: string;
  springFactor: string;
  sFactorUpScaleP: string;
  sFactorDownScaleP: string;
  lastTradePrice: string;
  maxLeverage: string;
  group: PairGroup;
  fee: PairFee;
}

export interface OpenTradePair {
  id: string;
  feed: string;
  from: string;
  to: string;
  accRollover: string;
  lastRolloverBlock: string;
  rolloverFeePerBlock: string;
  accFundingLong: string;
  spreadP: string;
  accFundingShort: string;
  longOI: string;
  shortOI: string;
  maxOI: string;
  maxLeverage: string;
  hillInflectionPoint: string;
  hillPosScale: string;
  hillNegScale: string;
  springFactor: string;
  sFactorUpScaleP: string;
  sFactorDownScaleP: string;
  lastFundingBlock: string;
  maxFundingFeePerBlock: string;
  lastFundingRate: string;
}

export interface OpenTrade {
  tradeID: string;
  collateral: string;
  leverage: string;
  highestLeverage: string;
  openPrice: string;
  stopLossPrice: string;
  takeProfitPrice: string;
  isOpen: boolean;
  timestamp: string;
  isBuy: boolean;
  notional: string;
  tradeNotional: string;
  funding: string;
  rollover: string;
  trader: string;
  index: string;
  pair: OpenTradePair;
}

export interface OpenOrderPair {
  id: string;
  feed: string;
  from: string;
  to: string;
  accRollover: string;
  lastRolloverBlock: string;
  rolloverFeePerBlock: string;
  accFundingLong: string;
  spreadP: string;
  accFundingShort: string;
  longOI: string;
  shortOI: string;
  lastFundingBlock: string;
  maxFundingFeePerBlock: string;
  lastFundingRate: string;
}

export interface OpenOrder {
  collateral: string;
  leverage: string;
  isBuy: boolean;
  isActive: boolean;
  id: string;
  openPrice: string;
  takeProfitPrice: string;
  stopLossPrice: string;
  trader: string;
  initiatedAt: string;
  limitType: string;
  pair: OpenOrderPair;
}

// ---------------------------------------------------------------------------
// Price API
// ---------------------------------------------------------------------------

export interface PriceData {
  feed_id: string;
  bid: number;
  mid: number;
  ask: number;
  isMarketOpen: boolean;
  isDayTradingClosed: boolean;
  from: string;
  to: string;
  timestampSeconds: number;
}
