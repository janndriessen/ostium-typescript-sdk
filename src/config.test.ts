import { isAddress } from "viem";
import { describe, expect, it } from "vitest";
import { mainnetConfig, testnetConfig } from "./config.js";

describe("mainnetConfig", () => {
  it("has Arbitrum One chain ID", () => {
    expect(mainnetConfig.chainId).toBe(42161);
  });

  it("has a non-empty graph URL", () => {
    expect(mainnetConfig.graphUrl).toBeTruthy();
  });

  it("has valid contract addresses", () => {
    for (const address of Object.values(mainnetConfig.contracts)) {
      expect(isAddress(address)).toBe(true);
    }
  });
});

describe("testnetConfig", () => {
  it("has Arbitrum Sepolia chain ID", () => {
    expect(testnetConfig.chainId).toBe(421614);
  });

  it("has a non-empty graph URL", () => {
    expect(testnetConfig.graphUrl).toBeTruthy();
  });

  it("has valid contract addresses", () => {
    for (const address of Object.values(testnetConfig.contracts)) {
      expect(isAddress(address)).toBe(true);
    }
  });
});
