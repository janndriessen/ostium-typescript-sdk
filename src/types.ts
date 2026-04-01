import type { Address } from "viem";

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
