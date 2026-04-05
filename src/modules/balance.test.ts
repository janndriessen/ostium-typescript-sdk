import type { Address, PublicClient } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usdcAbi } from "../abi/usdc.js";
import { OstiumError } from "../errors.js";
import { Balance } from "./balance.js";

const USDC: Address = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
const TRADER: Address = "0x1234567890abcdef1234567890abcdef12345678";
const INVALID_ADDRESS = "not-an-address" as Address;

const readContractMock = vi.fn();
const getBalanceMock = vi.fn();

const mockPublicClient = {
  readContract: readContractMock,
  getBalance: getBalanceMock,
} as unknown as PublicClient;

beforeEach(() => {
  readContractMock.mockReset();
  getBalanceMock.mockReset();
});

describe("Balance", () => {
  describe("getUsdc", () => {
    it("calls readContract with correct args and returns the bigint", async () => {
      readContractMock.mockResolvedValue(1_000_000_000n);
      const balance = new Balance(mockPublicClient, USDC);

      const result = await balance.getUsdc(TRADER);

      expect(result).toBe(1_000_000_000n);
      expect(readContractMock).toHaveBeenCalledWith({
        address: USDC,
        abi: usdcAbi,
        functionName: "balanceOf",
        args: [TRADER],
      });
    });

    it("throws OstiumError on invalid address", async () => {
      const balance = new Balance(mockPublicClient, USDC);

      await expect(balance.getUsdc(INVALID_ADDRESS)).rejects.toThrow(OstiumError);
      expect(readContractMock).not.toHaveBeenCalled();
    });

    it("wraps underlying RPC errors in OstiumError", async () => {
      readContractMock.mockRejectedValue(new Error("RPC down"));
      const balance = new Balance(mockPublicClient, USDC);

      await expect(balance.getUsdc(TRADER)).rejects.toThrow(OstiumError);
      await expect(balance.getUsdc(TRADER)).rejects.toThrow("getUsdc failed");
    });
  });

  describe("getEth", () => {
    it("calls getBalance with correct args and returns the bigint", async () => {
      getBalanceMock.mockResolvedValue(2_000_000_000_000_000_000n);
      const balance = new Balance(mockPublicClient, USDC);

      const result = await balance.getEth(TRADER);

      expect(result).toBe(2_000_000_000_000_000_000n);
      expect(getBalanceMock).toHaveBeenCalledWith({ address: TRADER });
    });

    it("throws OstiumError on invalid address", async () => {
      const balance = new Balance(mockPublicClient, USDC);

      await expect(balance.getEth(INVALID_ADDRESS)).rejects.toThrow(OstiumError);
      expect(getBalanceMock).not.toHaveBeenCalled();
    });

    it("wraps underlying RPC errors in OstiumError", async () => {
      getBalanceMock.mockRejectedValue(new Error("RPC down"));
      const balance = new Balance(mockPublicClient, USDC);

      await expect(balance.getEth(TRADER)).rejects.toThrow(OstiumError);
      await expect(balance.getEth(TRADER)).rejects.toThrow("getEth failed");
    });
  });

  describe("getBalances", () => {
    it("returns both USDC and ETH balances in parallel", async () => {
      readContractMock.mockResolvedValue(1_000_000_000n);
      getBalanceMock.mockResolvedValue(2_000_000_000_000_000_000n);
      const balance = new Balance(mockPublicClient, USDC);

      const result = await balance.getBalances(TRADER);

      expect(result).toEqual({
        usdc: 1_000_000_000n,
        eth: 2_000_000_000_000_000_000n,
      });
      expect(readContractMock).toHaveBeenCalledOnce();
      expect(getBalanceMock).toHaveBeenCalledOnce();
    });

    it("surfaces invalid-address errors from inner calls", async () => {
      const balance = new Balance(mockPublicClient, USDC);

      await expect(balance.getBalances(INVALID_ADDRESS)).rejects.toThrow(OstiumError);
      expect(readContractMock).not.toHaveBeenCalled();
      expect(getBalanceMock).not.toHaveBeenCalled();
    });
  });
});
