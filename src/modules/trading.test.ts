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
  describe("USDC approval (via openTrade)", () => {
    it("skips approval when allowance is sufficient", async () => {
      readContractMock.mockResolvedValue(1000000000n);
      writeContractMock.mockResolvedValue("0xtradeHash");
      waitForTransactionReceiptMock.mockResolvedValue({ status: "success", logs: [] });
      const trading = new Trading(mockPublicClient, mockWalletClient, mockAccount, mockConfig);

      await trading.openTrade(validParams, 107000);

      // Only one writeContract call (the trade itself, not an approval)
      expect(writeContractMock).toHaveBeenCalledOnce();
      expect(writeContractMock).toHaveBeenCalledWith(
        expect.objectContaining({ functionName: "openTrade" }),
      );
    });

    it("approves exact collateral to TradingStorage when insufficient", async () => {
      readContractMock.mockResolvedValue(0n);
      writeContractMock
        .mockResolvedValueOnce("0xapprovalHash")
        .mockResolvedValueOnce("0xtradeHash");
      waitForTransactionReceiptMock.mockResolvedValue({ status: "success", logs: [] });
      const trading = new Trading(mockPublicClient, mockWalletClient, mockAccount, mockConfig);

      await trading.openTrade(validParams, 107000);

      // First call is approval, second is the trade
      expect(writeContractMock).toHaveBeenCalledTimes(2);
      expect(writeContractMock).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          functionName: "approve",
          args: [mockConfig.contracts.tradingStorage, 100000000n],
        }),
      );
    });

    it("wraps approval errors in OstiumError", async () => {
      readContractMock.mockResolvedValue(0n);
      writeContractMock.mockRejectedValue(new Error("tx reverted"));
      const trading = new Trading(mockPublicClient, mockWalletClient, mockAccount, mockConfig);

      await expect(trading.openTrade(validParams, 107000)).rejects.toThrow(OstiumError);
    });

    it("throws when approval receipt is reverted", async () => {
      readContractMock.mockResolvedValue(0n);
      writeContractMock.mockResolvedValue("0xapprovalHash");
      waitForTransactionReceiptMock.mockResolvedValue({ status: "reverted" });
      const trading = new Trading(mockPublicClient, mockWalletClient, mockAccount, mockConfig);

      await expect(trading.openTrade(validParams, 107000)).rejects.toThrow(OstiumError);
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
      readContractMock.mockResolvedValue(1000000000n); // sufficient allowance
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
      expect(args[3]).toBe(107000000000000000000000n); // price scaled to 18 decimals
      expect(args[4]).toBe(200); // default 2% slippage → 200
    });

    it("allows custom slippage override", async () => {
      setupSuccessfulClose();
      const trading = new Trading(mockPublicClient, mockWalletClient, mockAccount, mockConfig);

      await trading.closeTrade(0, 0, 107000, 100, 5);

      const args = writeContractMock.mock.calls[0][0].args;
      expect(args[4]).toBe(500); // 5% → 500
    });

    it("returns TransactionResult with orderId", async () => {
      const PRICE_REQUESTED_TOPIC =
        "0x8195bed39a3fd3cf674a481e5c9ebcec05361cfca110f800bedda374c24bdeea";
      readContractMock.mockResolvedValue(1000000000n);
      writeContractMock.mockResolvedValue("0xcloseHash");
      waitForTransactionReceiptMock.mockResolvedValue({
        status: "success",
        logs: [
          {
            topics: [PRICE_REQUESTED_TOPIC, `0x${7n.toString(16).padStart(64, "0")}`],
          },
        ],
      });
      const trading = new Trading(mockPublicClient, mockWalletClient, mockAccount, mockConfig);

      const result = await trading.closeTrade(0, 0, 107000);

      expect(result.transactionHash).toBe("0xcloseHash");
      expect(result.orderId).toBe("7");
    });

    it("throws on reverted receipt", async () => {
      readContractMock.mockResolvedValue(1000000000n);
      writeContractMock.mockResolvedValue("0xhash");
      waitForTransactionReceiptMock.mockResolvedValue({ status: "reverted", logs: [] });
      const trading = new Trading(mockPublicClient, mockWalletClient, mockAccount, mockConfig);

      await expect(trading.closeTrade(0, 0, 107000)).rejects.toThrow(OstiumError);
      await expect(trading.closeTrade(0, 0, 107000)).rejects.toThrow("closeTrade failed");
    });
  });

  describe("updateTp", () => {
    it("rejects invalid pairIndex", async () => {
      const trading = new Trading(mockPublicClient, mockWalletClient, mockAccount, mockConfig);
      await expect(trading.updateTp(-1, 0, 110000)).rejects.toThrow(OstiumError);
    });

    it("rejects invalid tradeIndex", async () => {
      const trading = new Trading(mockPublicClient, mockWalletClient, mockAccount, mockConfig);
      await expect(trading.updateTp(0, 256, 110000)).rejects.toThrow(OstiumError);
    });

    it("rejects negative tp price", async () => {
      const trading = new Trading(mockPublicClient, mockWalletClient, mockAccount, mockConfig);
      await expect(trading.updateTp(0, 0, -1)).rejects.toThrow(OstiumError);
      expect(writeContractMock).not.toHaveBeenCalled();
    });

    it("allows zero tp (removes take profit)", async () => {
      writeContractMock.mockResolvedValue("0xtpHash");
      waitForTransactionReceiptMock.mockResolvedValue({ status: "success" });
      const trading = new Trading(mockPublicClient, mockWalletClient, mockAccount, mockConfig);

      await trading.updateTp(0, 0, 0);

      const args = writeContractMock.mock.calls[0][0].args;
      expect(args[2]).toBe(0n);
    });

    it("sends correct args to contract", async () => {
      writeContractMock.mockResolvedValue("0xtpHash");
      waitForTransactionReceiptMock.mockResolvedValue({ status: "success" });
      const trading = new Trading(mockPublicClient, mockWalletClient, mockAccount, mockConfig);

      await trading.updateTp(0, 1, 110000);

      expect(writeContractMock).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "updateTp",
          args: [0, 1, 110000000000000000000000n],
        }),
      );
    });

    it("returns TransactionResult without orderId", async () => {
      writeContractMock.mockResolvedValue("0xtpHash");
      waitForTransactionReceiptMock.mockResolvedValue({ status: "success" });
      const trading = new Trading(mockPublicClient, mockWalletClient, mockAccount, mockConfig);

      const result = await trading.updateTp(0, 0, 110000);

      expect(result.transactionHash).toBe("0xtpHash");
      expect(result.orderId).toBeUndefined();
    });

    it("throws on reverted receipt", async () => {
      writeContractMock.mockResolvedValue("0xhash");
      waitForTransactionReceiptMock.mockResolvedValue({ status: "reverted" });
      const trading = new Trading(mockPublicClient, mockWalletClient, mockAccount, mockConfig);

      await expect(trading.updateTp(0, 0, 110000)).rejects.toThrow(OstiumError);
    });
  });

  describe("updateSl", () => {
    it("rejects invalid pairIndex", async () => {
      const trading = new Trading(mockPublicClient, mockWalletClient, mockAccount, mockConfig);
      await expect(trading.updateSl(-1, 0, 90000)).rejects.toThrow(OstiumError);
    });

    it("rejects invalid tradeIndex", async () => {
      const trading = new Trading(mockPublicClient, mockWalletClient, mockAccount, mockConfig);
      await expect(trading.updateSl(0, 256, 90000)).rejects.toThrow(OstiumError);
    });

    it("rejects negative sl price", async () => {
      const trading = new Trading(mockPublicClient, mockWalletClient, mockAccount, mockConfig);
      await expect(trading.updateSl(0, 0, -1)).rejects.toThrow(OstiumError);
      expect(writeContractMock).not.toHaveBeenCalled();
    });

    it("allows zero sl (removes stop loss)", async () => {
      writeContractMock.mockResolvedValue("0xslHash");
      waitForTransactionReceiptMock.mockResolvedValue({ status: "success" });
      const trading = new Trading(mockPublicClient, mockWalletClient, mockAccount, mockConfig);

      await trading.updateSl(0, 0, 0);

      const args = writeContractMock.mock.calls[0][0].args;
      expect(args[2]).toBe(0n);
    });

    it("sends correct args to contract", async () => {
      writeContractMock.mockResolvedValue("0xslHash");
      waitForTransactionReceiptMock.mockResolvedValue({ status: "success" });
      const trading = new Trading(mockPublicClient, mockWalletClient, mockAccount, mockConfig);

      await trading.updateSl(0, 1, 90000);

      expect(writeContractMock).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "updateSl",
          args: [0, 1, 90000000000000000000000n],
        }),
      );
    });

    it("returns TransactionResult without orderId", async () => {
      writeContractMock.mockResolvedValue("0xslHash");
      waitForTransactionReceiptMock.mockResolvedValue({ status: "success" });
      const trading = new Trading(mockPublicClient, mockWalletClient, mockAccount, mockConfig);

      const result = await trading.updateSl(0, 0, 90000);

      expect(result.transactionHash).toBe("0xslHash");
      expect(result.orderId).toBeUndefined();
    });

    it("throws on reverted receipt", async () => {
      writeContractMock.mockResolvedValue("0xhash");
      waitForTransactionReceiptMock.mockResolvedValue({ status: "reverted" });
      const trading = new Trading(mockPublicClient, mockWalletClient, mockAccount, mockConfig);

      await expect(trading.updateSl(0, 0, 90000)).rejects.toThrow(OstiumError);
    });
  });

  describe("addCollateral", () => {
    it("rejects invalid pairIndex", async () => {
      const trading = new Trading(mockPublicClient, mockWalletClient, mockAccount, mockConfig);
      await expect(trading.addCollateral(-1, 0, 50)).rejects.toThrow(OstiumError);
    });

    it("rejects invalid tradeIndex", async () => {
      const trading = new Trading(mockPublicClient, mockWalletClient, mockAccount, mockConfig);
      await expect(trading.addCollateral(0, 256, 50)).rejects.toThrow(OstiumError);
    });

    it("rejects zero amount", async () => {
      const trading = new Trading(mockPublicClient, mockWalletClient, mockAccount, mockConfig);
      await expect(trading.addCollateral(0, 0, 0)).rejects.toThrow(OstiumError);
      expect(writeContractMock).not.toHaveBeenCalled();
    });

    it("rejects negative amount", async () => {
      const trading = new Trading(mockPublicClient, mockWalletClient, mockAccount, mockConfig);
      await expect(trading.addCollateral(0, 0, -10)).rejects.toThrow(OstiumError);
      expect(writeContractMock).not.toHaveBeenCalled();
    });

    it("calls ensureAllowance with scaled amount", async () => {
      readContractMock.mockResolvedValue(1000000000n);
      writeContractMock.mockResolvedValue("0xhash");
      waitForTransactionReceiptMock.mockResolvedValue(mockSuccessReceipt);
      const trading = new Trading(mockPublicClient, mockWalletClient, mockAccount, mockConfig);

      await trading.addCollateral(0, 1, 50);

      expect(readContractMock).toHaveBeenCalledWith(
        expect.objectContaining({ functionName: "allowance" }),
      );
    });

    it("approves when allowance insufficient", async () => {
      readContractMock.mockResolvedValue(0n);
      writeContractMock.mockResolvedValueOnce("0xapprovalHash").mockResolvedValueOnce("0xhash");
      waitForTransactionReceiptMock.mockResolvedValue(mockSuccessReceipt);
      const trading = new Trading(mockPublicClient, mockWalletClient, mockAccount, mockConfig);

      await trading.addCollateral(0, 1, 50);

      expect(writeContractMock).toHaveBeenCalledTimes(2);
      expect(writeContractMock).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          functionName: "approve",
          args: [mockConfig.contracts.tradingStorage, 50000000n],
        }),
      );
    });

    it("sends correct args to contract", async () => {
      readContractMock.mockResolvedValue(1000000000n);
      writeContractMock.mockResolvedValue("0xhash");
      waitForTransactionReceiptMock.mockResolvedValue(mockSuccessReceipt);
      const trading = new Trading(mockPublicClient, mockWalletClient, mockAccount, mockConfig);

      await trading.addCollateral(2, 1, 50);

      expect(writeContractMock).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "topUpCollateral",
          args: [2, 1, 50000000n],
        }),
      );
    });

    it("returns TransactionResult without orderId", async () => {
      readContractMock.mockResolvedValue(1000000000n);
      writeContractMock.mockResolvedValue("0xhash");
      waitForTransactionReceiptMock.mockResolvedValue(mockSuccessReceipt);
      const trading = new Trading(mockPublicClient, mockWalletClient, mockAccount, mockConfig);

      const result = await trading.addCollateral(0, 0, 50);

      expect(result.transactionHash).toBe("0xhash");
      expect(result.orderId).toBeUndefined();
    });

    it("throws on reverted receipt", async () => {
      readContractMock.mockResolvedValue(1000000000n);
      writeContractMock.mockResolvedValue("0xhash");
      waitForTransactionReceiptMock.mockResolvedValue({ status: "reverted" });
      const trading = new Trading(mockPublicClient, mockWalletClient, mockAccount, mockConfig);

      await expect(trading.addCollateral(0, 0, 50)).rejects.toThrow(OstiumError);
    });

    it("wraps errors in OstiumError", async () => {
      readContractMock.mockResolvedValue(1000000000n);
      writeContractMock.mockRejectedValue(new Error("rpc error"));
      const trading = new Trading(mockPublicClient, mockWalletClient, mockAccount, mockConfig);

      await expect(trading.addCollateral(0, 0, 50)).rejects.toThrow(OstiumError);
    });
  });

  describe("removeCollateral", () => {
    it("rejects invalid pairIndex", async () => {
      const trading = new Trading(mockPublicClient, mockWalletClient, mockAccount, mockConfig);
      await expect(trading.removeCollateral(-1, 0, 50)).rejects.toThrow(OstiumError);
    });

    it("rejects invalid tradeIndex", async () => {
      const trading = new Trading(mockPublicClient, mockWalletClient, mockAccount, mockConfig);
      await expect(trading.removeCollateral(0, 256, 50)).rejects.toThrow(OstiumError);
    });

    it("rejects zero amount", async () => {
      const trading = new Trading(mockPublicClient, mockWalletClient, mockAccount, mockConfig);
      await expect(trading.removeCollateral(0, 0, 0)).rejects.toThrow(OstiumError);
      expect(writeContractMock).not.toHaveBeenCalled();
    });

    it("rejects negative amount", async () => {
      const trading = new Trading(mockPublicClient, mockWalletClient, mockAccount, mockConfig);
      await expect(trading.removeCollateral(0, 0, -10)).rejects.toThrow(OstiumError);
      expect(writeContractMock).not.toHaveBeenCalled();
    });

    it("does NOT call ensureAllowance", async () => {
      writeContractMock.mockResolvedValue("0xhash");
      waitForTransactionReceiptMock.mockResolvedValue(mockSuccessReceipt);
      const trading = new Trading(mockPublicClient, mockWalletClient, mockAccount, mockConfig);

      await trading.removeCollateral(0, 1, 50);

      expect(readContractMock).not.toHaveBeenCalled();
    });

    it("sends correct args to contract", async () => {
      writeContractMock.mockResolvedValue("0xhash");
      waitForTransactionReceiptMock.mockResolvedValue(mockSuccessReceipt);
      const trading = new Trading(mockPublicClient, mockWalletClient, mockAccount, mockConfig);

      await trading.removeCollateral(2, 1, 50);

      expect(writeContractMock).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "removeCollateral",
          args: [2, 1, 50000000n],
        }),
      );
    });

    it("extracts orderId from PriceRequested event", async () => {
      const PRICE_REQUESTED_TOPIC =
        "0x8195bed39a3fd3cf674a481e5c9ebcec05361cfca110f800bedda374c24bdeea";
      writeContractMock.mockResolvedValue("0xhash");
      waitForTransactionReceiptMock.mockResolvedValue({
        status: "success",
        logs: [
          {
            topics: [PRICE_REQUESTED_TOPIC, `0x${99n.toString(16).padStart(64, "0")}`],
          },
        ],
      });
      const trading = new Trading(mockPublicClient, mockWalletClient, mockAccount, mockConfig);

      const result = await trading.removeCollateral(0, 0, 50);

      expect(result.transactionHash).toBe("0xhash");
      expect(result.orderId).toBe("99");
    });

    it("throws on reverted receipt", async () => {
      writeContractMock.mockResolvedValue("0xhash");
      waitForTransactionReceiptMock.mockResolvedValue({ status: "reverted" });
      const trading = new Trading(mockPublicClient, mockWalletClient, mockAccount, mockConfig);

      await expect(trading.removeCollateral(0, 0, 50)).rejects.toThrow(OstiumError);
    });

    it("wraps errors in OstiumError", async () => {
      writeContractMock.mockRejectedValue(new Error("rpc error"));
      const trading = new Trading(mockPublicClient, mockWalletClient, mockAccount, mockConfig);

      await expect(trading.removeCollateral(0, 0, 50)).rejects.toThrow(OstiumError);
    });
  });

  describe("cancelLimitOrder", () => {
    it("rejects invalid pairIndex", async () => {
      const trading = new Trading(mockPublicClient, mockWalletClient, mockAccount, mockConfig);
      await expect(trading.cancelLimitOrder(-1, 0)).rejects.toThrow(OstiumError);
    });

    it("rejects invalid orderIndex", async () => {
      const trading = new Trading(mockPublicClient, mockWalletClient, mockAccount, mockConfig);
      await expect(trading.cancelLimitOrder(0, 256)).rejects.toThrow(OstiumError);
    });

    it("sends correct args to contract", async () => {
      writeContractMock.mockResolvedValue("0xcancelHash");
      waitForTransactionReceiptMock.mockResolvedValue({ status: "success" });
      const trading = new Trading(mockPublicClient, mockWalletClient, mockAccount, mockConfig);

      await trading.cancelLimitOrder(0, 1);

      expect(writeContractMock).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "cancelOpenLimitOrder",
          args: [0, 1],
        }),
      );
    });

    it("returns TransactionResult", async () => {
      writeContractMock.mockResolvedValue("0xcancelHash");
      waitForTransactionReceiptMock.mockResolvedValue({ status: "success" });
      const trading = new Trading(mockPublicClient, mockWalletClient, mockAccount, mockConfig);

      const result = await trading.cancelLimitOrder(0, 0);
      expect(result.transactionHash).toBe("0xcancelHash");
    });

    it("throws on reverted receipt", async () => {
      writeContractMock.mockResolvedValue("0xhash");
      waitForTransactionReceiptMock.mockResolvedValue({ status: "reverted" });
      const trading = new Trading(mockPublicClient, mockWalletClient, mockAccount, mockConfig);

      await expect(trading.cancelLimitOrder(0, 0)).rejects.toThrow(OstiumError);
    });
  });

  describe("updateLimitOrder", () => {
    const mockCurrentOrder = {
      collateral: 100000000n,
      targetPrice: 107000000000000000000000n,
      tp: 110000000000000000000000n,
      sl: 90000000000000000000000n,
      trader: "0x1234567890abcdef1234567890abcdef12345678",
      leverage: 1000,
      createdAt: 1748460056,
      lastUpdated: 1748460056,
      pairIndex: 0,
      orderType: 1,
      index: 0,
      buy: true,
    };

    it("rejects invalid pairIndex", async () => {
      const trading = new Trading(mockPublicClient, mockWalletClient, mockAccount, mockConfig);
      await expect(trading.updateLimitOrder(-1, 0, 108000)).rejects.toThrow(OstiumError);
    });

    it("rejects invalid orderIndex", async () => {
      const trading = new Trading(mockPublicClient, mockWalletClient, mockAccount, mockConfig);
      await expect(trading.updateLimitOrder(0, 256, 108000)).rejects.toThrow(OstiumError);
    });

    it("rejects invalid price", async () => {
      const trading = new Trading(mockPublicClient, mockWalletClient, mockAccount, mockConfig);
      await expect(trading.updateLimitOrder(0, 0, -1)).rejects.toThrow(OstiumError);
    });

    it("rejects when no fields to update", async () => {
      const trading = new Trading(mockPublicClient, mockWalletClient, mockAccount, mockConfig);
      await expect(trading.updateLimitOrder(0, 0)).rejects.toThrow(OstiumError);
      await expect(trading.updateLimitOrder(0, 0)).rejects.toThrow("at least one of");
      expect(readContractMock).not.toHaveBeenCalled();
    });

    it("wraps storage read failures in OstiumError", async () => {
      readContractMock.mockRejectedValue(new Error("RPC unavailable"));
      const trading = new Trading(mockPublicClient, mockWalletClient, mockAccount, mockConfig);

      await expect(trading.updateLimitOrder(0, 0, 108000)).rejects.toThrow(OstiumError);
      await expect(trading.updateLimitOrder(0, 0, 108000)).rejects.toThrow(
        "updateLimitOrder failed",
      );
    });

    it("reads current order and updates only provided fields", async () => {
      readContractMock.mockResolvedValue(mockCurrentOrder);
      writeContractMock.mockResolvedValue("0xupdateHash");
      waitForTransactionReceiptMock.mockResolvedValue({ status: "success" });
      const trading = new Trading(mockPublicClient, mockWalletClient, mockAccount, mockConfig);

      await trading.updateLimitOrder(0, 0, 108000);

      // Should read current order first
      expect(readContractMock).toHaveBeenCalledWith(
        expect.objectContaining({ functionName: "getOpenLimitOrder" }),
      );

      const args = writeContractMock.mock.calls[0][0].args;
      expect(args[0]).toBe(0); // pairIndex
      expect(args[1]).toBe(0); // orderIndex
      expect(args[2]).toBe(108000000000000000000000n); // new price
      expect(args[3]).toBe(mockCurrentOrder.tp); // kept from current
      expect(args[4]).toBe(mockCurrentOrder.sl); // kept from current
    });

    it("updates all fields when all provided", async () => {
      readContractMock.mockResolvedValue(mockCurrentOrder);
      writeContractMock.mockResolvedValue("0xupdateHash");
      waitForTransactionReceiptMock.mockResolvedValue({ status: "success" });
      const trading = new Trading(mockPublicClient, mockWalletClient, mockAccount, mockConfig);

      await trading.updateLimitOrder(0, 0, 108000, 115000, 95000);

      const args = writeContractMock.mock.calls[0][0].args;
      expect(args[2]).toBe(108000000000000000000000n);
      expect(args[3]).toBe(115000000000000000000000n);
      expect(args[4]).toBe(95000000000000000000000n);
    });

    it("returns TransactionResult", async () => {
      readContractMock.mockResolvedValue(mockCurrentOrder);
      writeContractMock.mockResolvedValue("0xupdateHash");
      waitForTransactionReceiptMock.mockResolvedValue({ status: "success" });
      const trading = new Trading(mockPublicClient, mockWalletClient, mockAccount, mockConfig);

      const result = await trading.updateLimitOrder(0, 0, 108000);
      expect(result.transactionHash).toBe("0xupdateHash");
    });

    it("throws on reverted receipt", async () => {
      readContractMock.mockResolvedValue(mockCurrentOrder);
      writeContractMock.mockResolvedValue("0xhash");
      waitForTransactionReceiptMock.mockResolvedValue({ status: "reverted" });
      const trading = new Trading(mockPublicClient, mockWalletClient, mockAccount, mockConfig);

      await expect(trading.updateLimitOrder(0, 0, 108000)).rejects.toThrow(OstiumError);
    });
  });

  describe("timeout recovery", () => {
    // PriceRequested topic + an orderId=99 indexed arg, used to prove
    // extractOrderId wiring on the retry path.
    const PRICE_REQUESTED_TOPIC =
      "0x8195bed39a3fd3cf674a481e5c9ebcec05361cfca110f800bedda374c24bdeea";
    const priceRequestedLog = {
      topics: [PRICE_REQUESTED_TOPIC, `0x${99n.toString(16).padStart(64, "0")}`],
    };

    describe("openTradeMarketTimeout", () => {
      it("rejects invalid orderId", async () => {
        const trading = new Trading(mockPublicClient, mockWalletClient, mockAccount, mockConfig);
        await expect(trading.openTradeMarketTimeout("")).rejects.toThrow(OstiumError);
        await expect(trading.openTradeMarketTimeout("abc")).rejects.toThrow(OstiumError);
        await expect(trading.openTradeMarketTimeout("-1")).rejects.toThrow(OstiumError);
        expect(writeContractMock).not.toHaveBeenCalled();
      });

      it("sends correct args to contract", async () => {
        writeContractMock.mockResolvedValue("0xtimeoutHash");
        waitForTransactionReceiptMock.mockResolvedValue({ status: "success", logs: [] });
        const trading = new Trading(mockPublicClient, mockWalletClient, mockAccount, mockConfig);

        await trading.openTradeMarketTimeout("42");

        expect(writeContractMock).toHaveBeenCalledWith(
          expect.objectContaining({
            functionName: "openTradeMarketTimeout",
            args: [42n],
          }),
        );
      });

      it("does not call readContract (no allowance check)", async () => {
        writeContractMock.mockResolvedValue("0xtimeoutHash");
        waitForTransactionReceiptMock.mockResolvedValue({ status: "success", logs: [] });
        const trading = new Trading(mockPublicClient, mockWalletClient, mockAccount, mockConfig);

        await trading.openTradeMarketTimeout("42");

        expect(readContractMock).not.toHaveBeenCalled();
      });

      it("throws on reverted receipt", async () => {
        writeContractMock.mockResolvedValue("0xhash");
        waitForTransactionReceiptMock.mockResolvedValue({ status: "reverted" });
        const trading = new Trading(mockPublicClient, mockWalletClient, mockAccount, mockConfig);

        await expect(trading.openTradeMarketTimeout("42")).rejects.toThrow(OstiumError);
      });
    });

    describe("closeTradeMarketTimeout", () => {
      it("rejects invalid orderId", async () => {
        const trading = new Trading(mockPublicClient, mockWalletClient, mockAccount, mockConfig);
        await expect(trading.closeTradeMarketTimeout("")).rejects.toThrow(OstiumError);
        expect(writeContractMock).not.toHaveBeenCalled();
      });

      it("defaults retry to false", async () => {
        writeContractMock.mockResolvedValue("0xtimeoutHash");
        waitForTransactionReceiptMock.mockResolvedValue({ status: "success", logs: [] });
        const trading = new Trading(mockPublicClient, mockWalletClient, mockAccount, mockConfig);

        await trading.closeTradeMarketTimeout("42");

        expect(writeContractMock).toHaveBeenCalledWith(
          expect.objectContaining({
            functionName: "closeTradeMarketTimeout",
            args: [42n, false],
          }),
        );
      });

      it("forwards retry=true", async () => {
        writeContractMock.mockResolvedValue("0xtimeoutHash");
        waitForTransactionReceiptMock.mockResolvedValue({ status: "success", logs: [] });
        const trading = new Trading(mockPublicClient, mockWalletClient, mockAccount, mockConfig);

        await trading.closeTradeMarketTimeout("42", true);

        expect(writeContractMock).toHaveBeenCalledWith(
          expect.objectContaining({
            functionName: "closeTradeMarketTimeout",
            args: [42n, true],
          }),
        );
      });

      it("returns new orderId from PriceRequested log on retry", async () => {
        writeContractMock.mockResolvedValue("0xtimeoutHash");
        waitForTransactionReceiptMock.mockResolvedValue({
          status: "success",
          logs: [priceRequestedLog],
        });
        const trading = new Trading(mockPublicClient, mockWalletClient, mockAccount, mockConfig);

        const result = await trading.closeTradeMarketTimeout("42", true);

        expect(result.orderId).toBe("99");
      });

      it("throws on reverted receipt", async () => {
        writeContractMock.mockResolvedValue("0xhash");
        waitForTransactionReceiptMock.mockResolvedValue({ status: "reverted" });
        const trading = new Trading(mockPublicClient, mockWalletClient, mockAccount, mockConfig);

        await expect(trading.closeTradeMarketTimeout("42", false)).rejects.toThrow(OstiumError);
      });
    });
  });
});
