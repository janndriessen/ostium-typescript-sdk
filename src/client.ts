import type { PublicClient } from "viem";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrum, arbitrumSepolia } from "viem/chains";
import { mainnetConfig, testnetConfig } from "./config.js";
import { OstiumError } from "./errors.js";
import { Balance } from "./modules/balance.js";
import { Price } from "./modules/price.js";
import { Subgraph } from "./modules/subgraph.js";
import { Trading } from "./modules/trading.js";
import type { FormattedPair, NetworkConfig, OstiumSDKConfig, Pair, PriceData } from "./types.js";

const CHAINS = { mainnet: arbitrum, testnet: arbitrumSepolia } as const;
const CONFIGS = { mainnet: mainnetConfig, testnet: testnetConfig } as const;

export class OstiumSDK {
  readonly price: Price;
  readonly subgraph: Subgraph;
  readonly balance: Balance;
  readonly networkConfig: NetworkConfig;

  private readonly _trading?: Trading;
  private readonly _publicClient: PublicClient;

  constructor(config: OstiumSDKConfig) {
    this.networkConfig = CONFIGS[config.network];
    const chain = CHAINS[config.network];

    this.price = new Price(config.logger);
    this.subgraph = new Subgraph(this.networkConfig.graphUrl, config.logger);

    const transport = http(config.rpcUrl);
    this._publicClient = createPublicClient({ chain, transport });

    this.balance = new Balance(
      this._publicClient,
      this.networkConfig.contracts.usdc,
      config.logger,
    );

    if (config.privateKey !== undefined) {
      let account: ReturnType<typeof privateKeyToAccount>;
      try {
        account = privateKeyToAccount(config.privateKey as `0x${string}`);
      } catch (error) {
        throw new OstiumError("Invalid privateKey", {
          cause: error,
          suggestion: "privateKey must be a 0x-prefixed 64-character hex string",
        });
      }

      const walletClient = createWalletClient({ account, chain, transport });

      this._trading = new Trading(
        this._publicClient,
        walletClient,
        account,
        this.networkConfig,
        config.logger,
        config.builder,
      );
    }
  }

  get trading(): Trading {
    if (!this._trading) {
      throw new OstiumError("Trading requires a privateKey", {
        suggestion: "Pass a privateKey in OstiumSDKConfig to enable trading",
      });
    }
    return this._trading;
  }

  async getFormattedPairsDetails(includePrices = true): Promise<FormattedPair[]> {
    const pairs = await this.subgraph.getPairs();

    const priceMap = new Map<string, PriceData>();
    if (includePrices) {
      for (const p of await this.price.getLatestPrices()) {
        priceMap.set(`${p.from}-${p.to}`, p);
      }
    }

    return pairs
      .map((pair) => formatPair(pair, priceMap.get(`${pair.from}-${pair.to}`)))
      .sort((a, b) => a.id - b.id);
  }

  async connect(): Promise<void> {
    try {
      const chainId = await this._publicClient.getChainId();
      if (chainId !== this.networkConfig.chainId) {
        throw new OstiumError(
          `Chain ID mismatch: expected ${this.networkConfig.chainId}, got ${chainId}`,
          { suggestion: "Check your rpcUrl matches the configured network" },
        );
      }
    } catch (error) {
      if (error instanceof OstiumError) throw error;
      throw new OstiumError("Failed to connect to RPC", {
        cause: error,
        suggestion: "Check your rpcUrl is reachable",
      });
    }
  }
}

function formatPair(pair: Pair, priceData?: PriceData): FormattedPair {
  const groupMin = Number(pair.group.minLeverage);
  const groupMax = Number(pair.group.maxLeverage);
  const pairMax = Number(pair.maxLeverage);
  const overnight = Number(pair.overnightMaxLeverage);

  const formatted: FormattedPair = {
    id: Number(pair.id),
    from: pair.from,
    to: pair.to,
    group: pair.group.name,
    maxLeverage: (groupMax === 0 ? pairMax : groupMax) / 100,
    minLeverage: (groupMin === 0 ? groupMin : groupMin) / 100,
    makerMaxLeverage: Number(pair.makerMaxLeverage) / 100,
    maxOI: Number(pair.maxOI) / 1e6,
    longOI: Number(pair.longOI) / 1e18,
    shortOI: Number(pair.shortOI) / 1e18,
    makerFeeP: Number(pair.makerFeeP) / 1e6,
    takerFeeP: Number(pair.takerFeeP) / 1e6,
    groupMaxCollateralP: Number(pair.group.maxCollateralP) / 100,
    minLevPos: Number(pair.fee.minLevPos) / 1e6,
    lastFundingRate: Number(pair.lastFundingRate) / 1e9,
    curFundingLong: Number(pair.curFundingLong) / 1e9,
    curFundingShort: Number(pair.curFundingShort) / 1e9,
    lastFundingBlock: Number(pair.lastFundingBlock),
  };

  if (overnight !== 0) {
    formatted.overnightMaxLeverage = overnight / 100;
  }

  if (priceData) {
    formatted.price = priceData.mid;
    formatted.isMarketOpen = priceData.isMarketOpen;
    formatted.isDayTradingClosed = priceData.isDayTradingClosed;
  }

  return formatted;
}
