import type { Account, PublicClient, WalletClient } from "viem";
import { zeroAddress } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OstiumError } from "../errors.js";
import type { BuilderConfig, NetworkConfig, TradeParams } from "../types.js";
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

const validParams: TradeParams = {
  collateral: 100,
  leverage: 10,
  pairIndex: 0,
  direction: "long",
  orderType: "market",
};

const mockSuccessReceipt = {
  status: "success",
  logs: [],
};

function setupSuccessfulTrade() {
  // allowance sufficient (skip approval)
  readContractMock.mockResolvedValue(1000000000n);
  // openTrade tx hash
  writeContractMock.mockResolvedValue("0xtradeHash");
  // receipt
  waitForTransactionReceiptMock.mockResolvedValue(mockSuccessReceipt);
}

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
      waitForTransactionReceiptMock.mockResolvedValue({ status: "success" });
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
      waitForTransactionReceiptMock.mockResolvedValue({ status: "success" });
      const trading = new Trading(mockPublicClient, mockWalletClient, mockAccount, mockConfig);

      await trading.ensureAllowance(100000000n);

      const callArgs = writeContractMock.mock.calls[0][0];
      expect(callArgs.args[0]).toBe(mockConfig.contracts.tradingStorage);
    });

    it("waits for approval receipt", async () => {
      readContractMock.mockResolvedValue(0n);
      writeContractMock.mockResolvedValue("0xapprovalHash");
      waitForTransactionReceiptMock.mockResolvedValue({ status: "success" });
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

  describe("openTrade", () => {
    it("rejects invalid params", async () => {
      const trading = new Trading(mockPublicClient, mockWalletClient, mockAccount, mockConfig);
      const badParams = { ...validParams, collateral: 0 };

      await expect(trading.openTrade(badParams, 107000)).rejects.toThrow(OstiumError);
      expect(writeContractMock).not.toHaveBeenCalled();
    });

    it("rejects invalid price", async () => {
      const trading = new Trading(mockPublicClient, mockWalletClient, mockAccount, mockConfig);

      await expect(trading.openTrade(validParams, 0)).rejects.toThrow(OstiumError);
      expect(writeContractMock).not.toHaveBeenCalled();
    });

    it("calls ensureAllowance with scaled collateral", async () => {
      setupSuccessfulTrade();
      const trading = new Trading(mockPublicClient, mockWalletClient, mockAccount, mockConfig);

      await trading.openTrade(validParams, 107000);

      // readContract was called for allowance check
      expect(readContractMock).toHaveBeenCalledWith(
        expect.objectContaining({ functionName: "allowance" }),
      );
    });

    it("sends correct trade struct to contract", async () => {
      setupSuccessfulTrade();
      const trading = new Trading(mockPublicClient, mockWalletClient, mockAccount, mockConfig);

      await trading.openTrade(validParams, 107000);

      expect(writeContractMock).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "openTrade",
          address: mockConfig.contracts.trading,
        }),
      );

      const args = writeContractMock.mock.calls[0][0].args;
      const trade = args[0];
      expect(trade.collateral).toBe(100000000n); // 100 USDC → 6 decimals
      expect(trade.leverage).toBe(1000); // 10x → 2 decimals
      expect(trade.pairIndex).toBe(0);
      expect(trade.index).toBe(0);
      expect(trade.buy).toBe(true);
    });

    it("maps direction to buy boolean", async () => {
      setupSuccessfulTrade();
      const trading = new Trading(mockPublicClient, mockWalletClient, mockAccount, mockConfig);

      await trading.openTrade({ ...validParams, direction: "short" }, 107000);

      const trade = writeContractMock.mock.calls[0][0].args[0];
      expect(trade.buy).toBe(false);
    });

    it("maps orderType to uint8", async () => {
      setupSuccessfulTrade();
      const trading = new Trading(mockPublicClient, mockWalletClient, mockAccount, mockConfig);

      await trading.openTrade({ ...validParams, orderType: "limit" }, 107000);

      const orderType = writeContractMock.mock.calls[0][0].args[2];
      expect(orderType).toBe(1);
    });

    it("defaults slippage to 200 for market orders", async () => {
      setupSuccessfulTrade();
      const trading = new Trading(mockPublicClient, mockWalletClient, mockAccount, mockConfig);

      await trading.openTrade(validParams, 107000);

      const slippage = writeContractMock.mock.calls[0][0].args[3];
      expect(slippage).toBe(200n); // 2% → scaled ×100
    });

    it("defaults slippage to 0 for limit orders", async () => {
      setupSuccessfulTrade();
      const trading = new Trading(mockPublicClient, mockWalletClient, mockAccount, mockConfig);

      await trading.openTrade({ ...validParams, orderType: "limit" }, 107000);

      const slippage = writeContractMock.mock.calls[0][0].args[3];
      expect(slippage).toBe(0n);
    });

    it("uses explicit slippage when provided", async () => {
      setupSuccessfulTrade();
      const trading = new Trading(mockPublicClient, mockWalletClient, mockAccount, mockConfig);

      await trading.openTrade({ ...validParams, slippage: 5 }, 107000);

      const slippage = writeContractMock.mock.calls[0][0].args[3];
      expect(slippage).toBe(500n); // 5% → scaled ×100
    });

    it("forces slippage to 0 for limit orders even if explicitly provided", async () => {
      setupSuccessfulTrade();
      const trading = new Trading(mockPublicClient, mockWalletClient, mockAccount, mockConfig);

      await trading.openTrade({ ...validParams, orderType: "limit", slippage: 5 }, 107000);

      const slippage = writeContractMock.mock.calls[0][0].args[3];
      expect(slippage).toBe(0n);
    });

    it("forces slippage to 0 for stop orders even if explicitly provided", async () => {
      setupSuccessfulTrade();
      const trading = new Trading(mockPublicClient, mockWalletClient, mockAccount, mockConfig);

      await trading.openTrade({ ...validParams, orderType: "stop", slippage: 5 }, 107000);

      const slippage = writeContractMock.mock.calls[0][0].args[3];
      expect(slippage).toBe(0n);
    });

    it("defaults tp and sl to 0 when omitted", async () => {
      setupSuccessfulTrade();
      const trading = new Trading(mockPublicClient, mockWalletClient, mockAccount, mockConfig);

      await trading.openTrade(validParams, 107000);

      const trade = writeContractMock.mock.calls[0][0].args[0];
      expect(trade.tp).toBe(0n);
      expect(trade.sl).toBe(0n);
    });

    it("uses zero address when no builder config", async () => {
      setupSuccessfulTrade();
      const trading = new Trading(mockPublicClient, mockWalletClient, mockAccount, mockConfig);

      await trading.openTrade(validParams, 107000);

      const bf = writeContractMock.mock.calls[0][0].args[1];
      expect(bf.builder).toBe(zeroAddress);
      expect(bf.builderFee).toBe(0);
    });

    it("builds builder fee from config", async () => {
      setupSuccessfulTrade();
      const builder: BuilderConfig = {
        address: "0xBuilderAddress0000000000000000000000000000",
        feePercent: 0.1,
      };
      const trading = new Trading(
        mockPublicClient,
        mockWalletClient,
        mockAccount,
        mockConfig,
        undefined,
        builder,
      );

      await trading.openTrade(validParams, 107000);

      const bf = writeContractMock.mock.calls[0][0].args[1];
      expect(bf.builder).toBe(builder.address);
      expect(bf.builderFee).toBe(10000); // 0.1% → 10000 (scaled by 1e5)
    });

    it("returns TransactionResult with orderId", async () => {
      readContractMock.mockResolvedValue(1000000000n);
      writeContractMock.mockResolvedValue("0xtradeHash");

      const PRICE_REQUESTED_TOPIC =
        "0x8195bed39a3fd3cf674a481e5c9ebcec05361cfca110f800bedda374c24bdeea";
      waitForTransactionReceiptMock.mockResolvedValue({
        status: "success",
        logs: [
          {
            topics: [PRICE_REQUESTED_TOPIC, `0x${42n.toString(16).padStart(64, "0")}`],
          },
        ],
      });

      const trading = new Trading(mockPublicClient, mockWalletClient, mockAccount, mockConfig);
      const result = await trading.openTrade(validParams, 107000);

      expect(result.transactionHash).toBe("0xtradeHash");
      expect(result.orderId).toBe("42");
      expect(result.receipt).toBeDefined();
    });

    it("throws on reverted trade receipt", async () => {
      readContractMock.mockResolvedValue(1000000000n);
      writeContractMock.mockResolvedValue("0xhash");
      waitForTransactionReceiptMock.mockResolvedValue({ status: "reverted", logs: [] });

      const trading = new Trading(mockPublicClient, mockWalletClient, mockAccount, mockConfig);

      await expect(trading.openTrade(validParams, 107000)).rejects.toThrow(OstiumError);
      await expect(trading.openTrade(validParams, 107000)).rejects.toThrow("openTrade failed");
    });
  });

  describe("closeTrade", () => {
    function setupSuccessfulClose() {
      writeContractMock.mockResolvedValue("0xcloseHash");
      waitForTransactionReceiptMock.mockResolvedValue({ status: "success", logs: [] });
    }

    it("rejects invalid pairIndex", async () => {
      const trading = new Trading(mockPublicClient, mockWalletClient, mockAccount, mockConfig);
      await expect(trading.closeTrade(-1, 0, 107000)).rejects.toThrow(OstiumError);
    });

    it("rejects invalid tradeIndex", async () => {
      const trading = new Trading(mockPublicClient, mockWalletClient, mockAccount, mockConfig);
      await expect(trading.closeTrade(0, 256, 107000)).rejects.toThrow(OstiumError);
    });

    it("rejects invalid price", async () => {
      const trading = new Trading(mockPublicClient, mockWalletClient, mockAccount, mockConfig);
      await expect(trading.closeTrade(0, 0, 0)).rejects.toThrow(OstiumError);
    });

    it("rejects invalid closePercentage", async () => {
      const trading = new Trading(mockPublicClient, mockWalletClient, mockAccount, mockConfig);
      await expect(trading.closeTrade(0, 0, 107000, 0)).rejects.toThrow(OstiumError);
      await expect(trading.closeTrade(0, 0, 107000, 101)).rejects.toThrow(OstiumError);
    });

    it("defaults closePercentage to 100", async () => {
      setupSuccessfulClose();
      const trading = new Trading(mockPublicClient, mockWalletClient, mockAccount, mockConfig);

      await trading.closeTrade(0, 0, 107000);

      const args = writeContractMock.mock.calls[0][0].args;
      expect(args[2]).toBe(10000); // 100% → 10000 basis points
    });

    it("sends correct args to contract", async () => {
      setupSuccessfulClose();
      const trading = new Trading(mockPublicClient, mockWalletClient, mockAccount, mockConfig);

      await trading.closeTrade(0, 1, 107000, 50);

      expect(writeContractMock).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "closeTradeMarket",
          address: mockConfig.contracts.trading,
        }),
      );

      const args = writeContractMock.mock.calls[0][0].args;
      expect(args[0]).toBe(0); // pairIndex
      expect(args[1]).toBe(1); // tradeIndex
      expect(args[2]).toBe(5000); // 50% → 5000 basis points
      expect(args[4]).toBe(200); // default 2% slippage → 200
    });

    it("returns TransactionResult", async () => {
      setupSuccessfulClose();
      const trading = new Trading(mockPublicClient, mockWalletClient, mockAccount, mockConfig);

      const result = await trading.closeTrade(0, 0, 107000);

      expect(result.transactionHash).toBe("0xcloseHash");
      expect(result.receipt).toBeDefined();
    });

    it("throws on reverted receipt", async () => {
      writeContractMock.mockResolvedValue("0xhash");
      waitForTransactionReceiptMock.mockResolvedValue({ status: "reverted", logs: [] });
      const trading = new Trading(mockPublicClient, mockWalletClient, mockAccount, mockConfig);

      await expect(trading.closeTrade(0, 0, 107000)).rejects.toThrow(OstiumError);
      await expect(trading.closeTrade(0, 0, 107000)).rejects.toThrow("closeTrade failed");
    });
  });
});
