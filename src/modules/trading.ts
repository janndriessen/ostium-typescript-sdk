import type { Account, PublicClient, WalletClient } from "viem";
import { usdcAbi } from "../abi/usdc.js";
import { OstiumError } from "../errors.js";
import type { Logger, NetworkConfig } from "../types.js";

export class Trading {
  private readonly publicClient: PublicClient;
  private readonly walletClient: WalletClient;
  private readonly account: Account;
  private readonly config: NetworkConfig;
  private readonly logger?: Logger;

  constructor(
    publicClient: PublicClient,
    walletClient: WalletClient,
    account: Account,
    config: NetworkConfig,
    logger?: Logger,
  ) {
    this.publicClient = publicClient;
    this.walletClient = walletClient;
    this.account = account;
    this.config = config;
    this.logger = logger;
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
      throw new OstiumError("USDC approval failed", { cause: error });
    }
  }
}
