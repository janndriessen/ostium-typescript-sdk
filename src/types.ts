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
// Order tracking
// ---------------------------------------------------------------------------

export interface OrderPair {
  id: string;
  from: string;
  to: string;
  feed: string;
}

export interface Order {
  id: string;
  trader: string;
  pair: OrderPair;
  tradeID: string;
  limitID: string;
  orderType: string;
  orderAction: string;
  price: string;
  priceAfterImpact: string;
  priceImpactP: string;
  collateral: string;
  notional: string;
  tradeNotional: string;
  profitPercent: string;
  totalProfitPercent: string;
  amountSentToTrader: string;
  isBuy: boolean;
  initiatedAt: string;
  executedAt: string;
  initiatedTx: string;
  executedTx: string;
  initiatedBlock: string;
  executedBlock: string;
  leverage: string;
  isPending: boolean;
  isCancelled: boolean;
  cancelReason: string | null;
  devFee: string;
  vaultFee: string;
  oracleFee: string;
  liquidationFee: string;
  fundingFee: string;
  rolloverFee: string;
  closePercent: string;
}

export interface Trade {
  id: string;
  trader: string;
  pair: OrderPair;
  index: string;
  tradeID: string;
  tradeType: string;
  openPrice: string;
  closePrice: string;
  takeProfitPrice: string;
  stopLossPrice: string;
  collateral: string;
  notional: string;
  tradeNotional: string;
  highestLeverage: string;
  leverage: string;
  isBuy: boolean;
  isOpen: boolean;
  closeInitiated: boolean;
  funding: string;
  rollover: string;
  timestamp: string;
}

export interface HistoryOrderPair {
  id: string;
  from: string;
  to: string;
  feed: string;
  longOI: string;
  shortOI: string;
  group: { name: string };
}

export interface HistoryOrder {
  id: string;
  isBuy: boolean;
  trader: string;
  notional: string;
  tradeNotional: string;
  collateral: string;
  leverage: string;
  orderType: string;
  orderAction: string;
  price: string;
  initiatedAt: string;
  executedAt: string;
  executedTx: string;
  isCancelled: boolean;
  cancelReason: string | null;
  profitPercent: string;
  totalProfitPercent: string;
  isPending: boolean;
  amountSentToTrader: string;
  rolloverFee: string;
  fundingFee: string;
  pair: HistoryOrderPair;
}

export interface TrackOrderOptions {
  intervalMs?: number;
  maxAttempts?: number;
}

export interface TrackOrderResult {
  order: Order;
  trade: Trade | null;
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
