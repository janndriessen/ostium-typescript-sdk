import type { Account, PublicClient, WalletClient } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OstiumError } from "../errors.js";
import type { NetworkConfig } from "../types.js";
import { Trading } from "./trading.js";

const mockConfig: NetworkConfig = {
  chainId: 42161,
  graphUrl: "https://example.com/graphql",
  contracts: {
    usdc: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    trading: "0x6D0bA1f9996DBD8885827e1b2e8f6593e7702411",
    tradingStorage: "0xcCd5891083A8acD2074690F65d3024E7D13d66E7",
  },
};

const mockAccount = {
  address: "0x1234567890abcdef1234567890abcdef12345678",
} as unknown as Account;

const readContractMock = vi.fn();
const writeContractMock = vi.fn();
const waitForTransactionReceiptMock = vi.fn();

const mockPublicClient = {
  readContract: readContractMock,
  waitForTransactionReceipt: waitForTransactionReceiptMock,
} as unknown as PublicClient;

const mockWalletClient = {
  writeContract: writeContractMock,
} as unknown as WalletClient;

beforeEach(() => {
  readContractMock.mockReset();
  writeContractMock.mockReset();
  waitForTransactionReceiptMock.mockReset();
});

describe("Trading", () => {
  describe("ensureAllowance", () => {
    it("skips approval when allowance is sufficient", async () => {
      readContractMock.mockResolvedValue(200000000n);
      const trading = new Trading(mockPublicClient, mockWalletClient, mockAccount, mockConfig);

      await trading.ensureAllowance(100000000n);

      expect(readContractMock).toHaveBeenCalledOnce();
      expect(writeContractMock).not.toHaveBeenCalled();
    });

    it("approves exact amount when allowance is insufficient", async () => {
      readContractMock.mockResolvedValue(0n);
      writeContractMock.mockResolvedValue("0xhash");
      waitForTransactionReceiptMock.mockResolvedValue({});
      const trading = new Trading(mockPublicClient, mockWalletClient, mockAccount, mockConfig);

      await trading.ensureAllowance(100000000n);

      expect(writeContractMock).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "approve",
          args: [mockConfig.contracts.tradingStorage, 100000000n],
        }),
      );
    });

    it("approves to TradingStorage address", async () => {
      readContractMock.mockResolvedValue(0n);
      writeContractMock.mockResolvedValue("0xhash");
      waitForTransactionReceiptMock.mockResolvedValue({});
      const trading = new Trading(mockPublicClient, mockWalletClient, mockAccount, mockConfig);

      await trading.ensureAllowance(100000000n);

      const callArgs = writeContractMock.mock.calls[0][0];
      expect(callArgs.args[0]).toBe(mockConfig.contracts.tradingStorage);
    });

    it("waits for approval receipt", async () => {
      readContractMock.mockResolvedValue(0n);
      writeContractMock.mockResolvedValue("0xapprovalHash");
      waitForTransactionReceiptMock.mockResolvedValue({});
      const trading = new Trading(mockPublicClient, mockWalletClient, mockAccount, mockConfig);

      await trading.ensureAllowance(100000000n);

      expect(waitForTransactionReceiptMock).toHaveBeenCalledWith({ hash: "0xapprovalHash" });
    });

    it("wraps approval errors in OstiumError", async () => {
      readContractMock.mockResolvedValue(0n);
      writeContractMock.mockRejectedValue(new Error("tx reverted"));
      const trading = new Trading(mockPublicClient, mockWalletClient, mockAccount, mockConfig);

      await expect(trading.ensureAllowance(100000000n)).rejects.toThrow(OstiumError);
      await expect(trading.ensureAllowance(100000000n)).rejects.toThrow("USDC approval failed");
    });

    it("throws on reverted approval receipt", async () => {
      readContractMock.mockResolvedValue(0n);
      writeContractMock.mockResolvedValue("0xhash");
      waitForTransactionReceiptMock.mockResolvedValue({ status: "reverted" });
      const trading = new Trading(mockPublicClient, mockWalletClient, mockAccount, mockConfig);

      await expect(trading.ensureAllowance(100000000n)).rejects.toThrow(OstiumError);
      await expect(trading.ensureAllowance(100000000n)).rejects.toThrow("USDC approval failed");
    });
  });
});
