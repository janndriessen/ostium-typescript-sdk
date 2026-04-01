import type { NetworkConfig } from "./types.js";

export const mainnetConfig = {
  chainId: 42161,
  graphUrl:
    "https://api.subgraph.ormilabs.com/api/public/67a599d5-c8d2-4cc4-9c4d-2975a97bc5d8/subgraphs/ost-prod/live/gn",
  contracts: {
    usdc: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    trading: "0x6D0bA1f9996DBD8885827e1b2e8f6593e7702411",
    tradingStorage: "0xcCd5891083A8acD2074690F65d3024E7D13d66E7",
  },
} as const satisfies NetworkConfig;

export const testnetConfig = {
  chainId: 421614,
  graphUrl:
    "https://api.subgraph.ormilabs.com/api/public/67a599d5-c8d2-4cc4-9c4d-2975a97bc5d8/subgraphs/ost-sep/live/gn",
  contracts: {
    usdc: "0xe73B11Fb1e3eeEe8AF2a23079A4410Fe1B370548",
    trading: "0x2A9B9c988393f46a2537B0ff11E98c2C15a95afe",
    tradingStorage: "0x0b9F5243B29938668c9Cfbd7557A389EC7Ef88b8",
  },
} as const satisfies NetworkConfig;
