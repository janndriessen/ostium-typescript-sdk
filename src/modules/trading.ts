import { type Account, type PublicClient, parseUnits, type WalletClient, zeroAddress } from "viem";
import { tradingAbi } from "../abi/trading.js";
import { tradingStorageAbi } from "../abi/tradingStorage.js";
import { usdcAbi } from "../abi/usdc.js";
import { OstiumError } from "../errors.js";
import type {
  BuilderConfig,
  Logger,
  NetworkConfig,
  TradeParams,
  TransactionResult,
} from "../types.js";
import {
  extractOrderId,
  toChainClosePercentage,
  toChainCollateral,
  toChainLeverage,
  toChainPrice,
  toChainSlippage,
  validateClosePercentage,
  validateNonNegativePrice,
  validateOrderId,
  validateOrderIndex,
  validatePairIndex,
  validatePrice,
  validateTradeIndex,
  validateTradeParams,
} from "../utils.js";

const ORDER_TYPE_MAP = { market: 0, limit: 1, stop: 2 } as const;
const DEFAULT_MARKET_SLIPPAGE = 2;

export class Trading {
  private readonly publicClient: PublicClient;
  private readonly walletClient: WalletClient;
  private readonly account: Account;
  private readonly config: NetworkConfig;
  private readonly logger?: Logger;
  private readonly builderConfig?: BuilderConfig;

  constructor(
    publicClient: PublicClient,
    walletClient: WalletClient,
    account: Account,
    config: NetworkConfig,
    logger?: Logger,
    builderConfig?: BuilderConfig,
  ) {
    this.publicClient = publicClient;
    this.walletClient = walletClient;
    this.account = account;
    this.config = config;
    this.logger = logger;
    this.builderConfig = builderConfig;
  }

  async openTrade(params: TradeParams, atPrice: number): Promise<TransactionResult> {
    validateTradeParams(params);
    validatePrice(atPrice);

    const collateral = toChainCollateral(params.collateral);
    const openPrice = toChainPrice(atPrice);
    const leverage = toChainLeverage(params.leverage);
    const tp = toChainPrice(params.tp ?? 0);
    const sl = toChainPrice(params.sl ?? 0);
    const buy = params.direction === "long";
    const orderType = ORDER_TYPE_MAP[params.orderType];

    const slippage =
      params.orderType === "market"
        ? toChainSlippage(params.slippage ?? DEFAULT_MARKET_SLIPPAGE)
        : 0n;

    const builderFee = this.builderConfig
      ? {
          builder: this.builderConfig.address,
          builderFee: Number(parseUnits(String(this.builderConfig.feePercent), 5)),
        }
      : { builder: zeroAddress, builderFee: 0 };

    this.logger?.info(
      `Opening ${params.direction} ${params.orderType} trade on pair ${params.pairIndex}`,
    );

    await this.ensureAllowance(collateral);

    try {
      const hash = await this.walletClient.writeContract({
        account: this.account,
        chain: null,
        address: this.config.contracts.trading,
        abi: tradingAbi,
        functionName: "openTrade",
        args: [
          {
            collateral,
            openPrice,
            tp,
            sl,
            trader: this.account.address,
            leverage: Number(leverage),
            pairIndex: params.pairIndex,
            index: 0,
            buy,
          },
          builderFee,
          orderType,
          slippage,
        ],
      });

      const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status === "reverted") {
        throw new Error("openTrade transaction reverted");
      }

      const orderId = extractOrderId(receipt);
      this.logger?.info(`Trade opened, orderId: ${orderId ?? "unknown"}`);

      return { transactionHash: hash, receipt, orderId };
    } catch (error) {
      if (error instanceof OstiumError) throw error;
      throw new OstiumError("openTrade failed", { cause: error });
    }
  }

  async closeTrade(
    pairIndex: number,
    tradeIndex: number,
    marketPrice: number,
    closePercentage = 100,
    slippage = DEFAULT_MARKET_SLIPPAGE,
  ): Promise<TransactionResult> {
    validatePairIndex(pairIndex);
    validateTradeIndex(tradeIndex);
    validatePrice(marketPrice);
    validateClosePercentage(closePercentage);

    const chainPrice = toChainPrice(marketPrice);
    const chainClosePercentage = toChainClosePercentage(closePercentage);
    const chainSlippage = toChainSlippage(slippage);

    // Closing may require allowance for fee settlement
    await this.ensureAllowance(toChainCollateral(1));

    this.logger?.info(`Closing ${closePercentage}% of trade ${tradeIndex} on pair ${pairIndex}`);

    try {
      const hash = await this.walletClient.writeContract({
        account: this.account,
        chain: null,
        address: this.config.contracts.trading,
        abi: tradingAbi,
        functionName: "closeTradeMarket",
        args: [
          pairIndex,
          tradeIndex,
          Number(chainClosePercentage),
          chainPrice,
          Number(chainSlippage),
        ],
      });

      const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status === "reverted") {
        throw new Error("closeTrade transaction reverted");
      }

      const orderId = extractOrderId(receipt);
      this.logger?.info(`Trade closed, orderId: ${orderId ?? "unknown"}`);

      return { transactionHash: hash, receipt, orderId };
    } catch (error) {
      if (error instanceof OstiumError) throw error;
      throw new OstiumError("closeTrade failed", { cause: error });
    }
  }

  async updateTp(pairIndex: number, tradeIndex: number, newTp: number): Promise<TransactionResult> {
    validatePairIndex(pairIndex);
    validateTradeIndex(tradeIndex);
    validateNonNegativePrice(newTp, "tp");

    const chainTp = toChainPrice(newTp);
    this.logger?.info(`Updating TP to ${newTp} for trade ${tradeIndex} on pair ${pairIndex}`);

    try {
      const hash = await this.walletClient.writeContract({
        account: this.account,
        chain: null,
        address: this.config.contracts.trading,
        abi: tradingAbi,
        functionName: "updateTp",
        args: [pairIndex, tradeIndex, chainTp],
      });

      const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status === "reverted") {
        throw new Error("updateTp transaction reverted");
      }

      return { transactionHash: hash, receipt };
    } catch (error) {
      if (error instanceof OstiumError) throw error;
      throw new OstiumError("updateTp failed", { cause: error });
    }
  }

  async updateSl(pairIndex: number, tradeIndex: number, newSl: number): Promise<TransactionResult> {
    validatePairIndex(pairIndex);
    validateTradeIndex(tradeIndex);
    validateNonNegativePrice(newSl, "sl");

    const chainSl = toChainPrice(newSl);
    this.logger?.info(`Updating SL to ${newSl} for trade ${tradeIndex} on pair ${pairIndex}`);

    try {
      const hash = await this.walletClient.writeContract({
        account: this.account,
        chain: null,
        address: this.config.contracts.trading,
        abi: tradingAbi,
        functionName: "updateSl",
        args: [pairIndex, tradeIndex, chainSl],
      });

      const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status === "reverted") {
        throw new Error("updateSl transaction reverted");
      }

      return { transactionHash: hash, receipt };
    } catch (error) {
      if (error instanceof OstiumError) throw error;
      throw new OstiumError("updateSl failed", { cause: error });
    }
  }

  async cancelLimitOrder(pairIndex: number, orderIndex: number): Promise<TransactionResult> {
    validatePairIndex(pairIndex);
    validateOrderIndex(orderIndex);

    this.logger?.info(`Cancelling limit order ${orderIndex} on pair ${pairIndex}`);

    try {
      const hash = await this.walletClient.writeContract({
        account: this.account,
        chain: null,
        address: this.config.contracts.trading,
        abi: tradingAbi,
        functionName: "cancelOpenLimitOrder",
        args: [pairIndex, orderIndex],
      });

      const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status === "reverted") {
        throw new Error("cancelLimitOrder transaction reverted");
      }

      return { transactionHash: hash, receipt };
    } catch (error) {
      if (error instanceof OstiumError) throw error;
      throw new OstiumError("cancelLimitOrder failed", { cause: error });
    }
  }

  async updateLimitOrder(
    pairIndex: number,
    orderIndex: number,
    price?: number,
    tp?: number,
    sl?: number,
  ): Promise<TransactionResult> {
    validatePairIndex(pairIndex);
    validateOrderIndex(orderIndex);
    if (price === undefined && tp === undefined && sl === undefined) {
      throw new OstiumError("updateLimitOrder requires at least one of: price, tp, sl");
    }
    if (price !== undefined) validatePrice(price);
    if (tp !== undefined) validateNonNegativePrice(tp, "tp");
    if (sl !== undefined) validateNonNegativePrice(sl, "sl");

    try {
      this.logger?.debug(`Reading current limit order ${orderIndex} on pair ${pairIndex}`);

      const currentOrder = await this.publicClient.readContract({
        address: this.config.contracts.tradingStorage,
        abi: tradingStorageAbi,
        functionName: "getOpenLimitOrder",
        args: [this.account.address, pairIndex, orderIndex],
      });

      const chainPrice = price !== undefined ? toChainPrice(price) : currentOrder.targetPrice;
      const chainTp = tp !== undefined ? toChainPrice(tp) : currentOrder.tp;
      const chainSl = sl !== undefined ? toChainPrice(sl) : currentOrder.sl;

      this.logger?.info(`Updating limit order ${orderIndex} on pair ${pairIndex}`);

      const hash = await this.walletClient.writeContract({
        account: this.account,
        chain: null,
        address: this.config.contracts.trading,
        abi: tradingAbi,
        functionName: "updateOpenLimitOrder",
        args: [pairIndex, orderIndex, chainPrice, chainTp, chainSl],
      });

      const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status === "reverted") {
        throw new Error("updateLimitOrder transaction reverted");
      }

      return { transactionHash: hash, receipt };
    } catch (error) {
      if (error instanceof OstiumError) throw error;
      throw new OstiumError("updateLimitOrder failed", { cause: error });
    }
  }

  /**
   * Recover a timed-out pending market open by cancelling it and refunding
   * collateral.
   *
   * Use this when an `openTrade` market order emitted a PriceRequested event
   * but the oracle never fulfilled it within the protocol's timeout window.
   * There is no retry path — the original market intent was "fill at the
   * current price", and by the time a timeout has elapsed that price is
   * stale. The only valid recovery is to cancel the pending open and refund
   * the trader's collateral.
   *
   * @param orderId - The orderId returned from the original `openTrade` call
   *                  (from `TransactionResult.orderId` or a subgraph query).
   */
  async openTradeMarketTimeout(orderId: string): Promise<TransactionResult> {
    const id = validateOrderId(orderId);
    this.logger?.info(`Recovering timed-out open for order ${id}`);

    try {
      const hash = await this.walletClient.writeContract({
        account: this.account,
        chain: null,
        address: this.config.contracts.trading,
        abi: tradingAbi,
        functionName: "openTradeMarketTimeout",
        args: [id],
      });

      const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status === "reverted") {
        throw new Error("openTradeMarketTimeout transaction reverted");
      }

      return { transactionHash: hash, receipt, orderId: extractOrderId(receipt) };
    } catch (error) {
      if (error instanceof OstiumError) throw error;
      throw new OstiumError("openTradeMarketTimeout failed", { cause: error });
    }
  }

  /**
   * Recover a timed-out pending market close.
   *
   * Use this when a `closeTrade` market order emitted a PriceRequested event
   * but the oracle never fulfilled it. Unlike the open variant, the position
   * is already on-chain, so both recovery paths are meaningful:
   *
   * - `retry=true`  — re-requests a fresh oracle price; the close will proceed
   *                   at whatever price the oracle returns. The returned
   *                   `TransactionResult.orderId` will contain the new request
   *                   id, which can be tracked like any other pending order.
   * - `retry=false` — cancels the pending close, leaving the position open.
   *                   (Default.)
   *
   * @param orderId - The orderId returned from the original `closeTrade` call.
   * @param retry   - If true, re-request a fresh oracle price. Defaults to
   *                  false (cancel).
   */
  async closeTradeMarketTimeout(orderId: string, retry = false): Promise<TransactionResult> {
    const id = validateOrderId(orderId);
    this.logger?.info(`Recovering timed-out close for order ${id} (${retry ? "retry" : "cancel"})`);

    try {
      const hash = await this.walletClient.writeContract({
        account: this.account,
        chain: null,
        address: this.config.contracts.trading,
        abi: tradingAbi,
        functionName: "closeTradeMarketTimeout",
        args: [id, retry],
      });

      const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status === "reverted") {
        throw new Error("closeTradeMarketTimeout transaction reverted");
      }

      return { transactionHash: hash, receipt, orderId: extractOrderId(receipt) };
    } catch (error) {
      if (error instanceof OstiumError) throw error;
      throw new OstiumError("closeTradeMarketTimeout failed", { cause: error });
    }
  }

  private async ensureAllowance(amount: bigint): Promise<void> {
    try {
      const allowance = await this.publicClient.readContract({
        address: this.config.contracts.usdc,
        abi: usdcAbi,
        functionName: "allowance",
        args: [this.account.address, this.config.contracts.tradingStorage],
      });

      if (allowance >= amount) {
        this.logger?.debug("USDC allowance sufficient, skipping approval");
        return;
      }

      this.logger?.info(`Approving ${amount} USDC to TradingStorage`);

      const hash = await this.walletClient.writeContract({
        account: this.account,
        chain: null,
        address: this.config.contracts.usdc,
        abi: usdcAbi,
        functionName: "approve",
        args: [this.config.contracts.tradingStorage, amount],
      });

      const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status === "reverted") {
        throw new Error("USDC approval transaction reverted");
      }
      this.logger?.debug("USDC approval confirmed");
    } catch (error) {
      if (error instanceof OstiumError) throw error;
      throw new OstiumError("USDC approval failed", { cause: error });
    }
  }
}
