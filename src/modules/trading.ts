import { type Account, type PublicClient, parseUnits, type WalletClient, zeroAddress } from "viem";
import { tradingAbi } from "../abi/trading.js";
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
  ): Promise<TransactionResult> {
    validatePairIndex(pairIndex);
    validateTradeIndex(tradeIndex);
    validatePrice(marketPrice);
    validateClosePercentage(closePercentage);

    const chainPrice = toChainPrice(marketPrice);
    const chainClosePercentage = toChainClosePercentage(closePercentage);
    const slippage = toChainSlippage(DEFAULT_MARKET_SLIPPAGE);

    this.logger?.info(`Closing ${closePercentage}% of trade ${tradeIndex} on pair ${pairIndex}`);

    try {
      const hash = await this.walletClient.writeContract({
        account: this.account,
        chain: null,
        address: this.config.contracts.trading,
        abi: tradingAbi,
        functionName: "closeTradeMarket",
        args: [pairIndex, tradeIndex, Number(chainClosePercentage), chainPrice, Number(slippage)],
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

  async ensureAllowance(amount: bigint): Promise<void> {
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
