import { describe, expect, it, vi } from "vitest";
import { OstiumError } from "./errors.js";
import type { Logger } from "./types.js";

const getChainIdMock = vi.fn();

vi.mock("viem", async (importOriginal) => {
  const actual = await importOriginal<typeof import("viem")>();
  return {
    ...actual,
    createPublicClient: vi.fn(() => ({ getChainId: getChainIdMock })),
    createWalletClient: vi.fn(() => ({})),
  };
});

vi.mock("viem/accounts", () => ({
  privateKeyToAccount: vi.fn((key: string) => {
    if (!key.startsWith("0x") || key.length !== 66) {
      throw new Error("Invalid private key");
    }
    return { address: "0x1234567890abcdef1234567890abcdef12345678" };
  }),
}));

const PriceSpy = vi.fn();
vi.mock("./modules/price.js", () => ({ Price: PriceSpy }));

const SubgraphSpy = vi.fn();
vi.mock("./modules/subgraph.js", () => ({ Subgraph: SubgraphSpy }));

const TradingSpy = vi.fn();
vi.mock("./modules/trading.js", () => ({ Trading: TradingSpy }));

// Import after mocks are set up
const { OstiumSDK } = await import("./client.js");

const TEST_PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

describe("OstiumSDK", () => {
  it("constructs without network calls", () => {
    const sdk = new OstiumSDK({ network: "testnet" });
    expect(sdk).toBeDefined();
    expect(getChainIdMock).not.toHaveBeenCalled();
  });

  it("price is always available", () => {
    const sdk = new OstiumSDK({ network: "testnet" });
    expect(sdk.price).toBeDefined();
  });

  it("subgraph is always available", () => {
    const sdk = new OstiumSDK({ network: "testnet" });
    expect(sdk.subgraph).toBeDefined();
  });

  it("balance is always available", () => {
    const sdk = new OstiumSDK({ network: "testnet" });
    expect(sdk.balance).toBeDefined();
  });

  it("trading throws in read-only mode", () => {
    const sdk = new OstiumSDK({ network: "testnet" });
    expect(() => sdk.trading).toThrow(OstiumError);
    expect(() => sdk.trading).toThrow("privateKey");
  });

  it("trading is available with privateKey", () => {
    const sdk = new OstiumSDK({
      network: "testnet",
      privateKey: TEST_PRIVATE_KEY,
    });
    expect(sdk.trading).toBeDefined();
  });

  it("throws OstiumError for invalid privateKey", () => {
    expect(() => new OstiumSDK({ network: "testnet", privateKey: "not-a-valid-key" })).toThrow(
      OstiumError,
    );
  });

  it("throws OstiumError for empty privateKey", () => {
    expect(() => new OstiumSDK({ network: "testnet", privateKey: "" })).toThrow(OstiumError);
  });

  it("exposes networkConfig", () => {
    const sdk = new OstiumSDK({ network: "mainnet" });
    expect(sdk.networkConfig.chainId).toBe(42161);

    const testSdk = new OstiumSDK({ network: "testnet" });
    expect(testSdk.networkConfig.chainId).toBe(421614);
  });

  describe("connect", () => {
    it("works in read-only mode (no privateKey required)", async () => {
      getChainIdMock.mockResolvedValue(421614);
      const sdk = new OstiumSDK({ network: "testnet" });

      await expect(sdk.connect()).resolves.toBeUndefined();
      expect(getChainIdMock).toHaveBeenCalled();
    });

    it("succeeds when chain ID matches", async () => {
      getChainIdMock.mockResolvedValue(421614);
      const sdk = new OstiumSDK({
        network: "testnet",
        privateKey: TEST_PRIVATE_KEY,
      });

      await expect(sdk.connect()).resolves.toBeUndefined();
    });

    it("throws on chain ID mismatch", async () => {
      getChainIdMock.mockResolvedValue(1);
      const sdk = new OstiumSDK({
        network: "testnet",
        privateKey: TEST_PRIVATE_KEY,
      });

      await expect(sdk.connect()).rejects.toThrow(OstiumError);
      await expect(sdk.connect()).rejects.toThrow("Chain ID mismatch");
    });

    it("wraps RPC errors in OstiumError when getChainId fails", async () => {
      getChainIdMock.mockRejectedValue(new Error("RPC unreachable"));
      const sdk = new OstiumSDK({
        network: "testnet",
        privateKey: TEST_PRIVATE_KEY,
      });

      await expect(sdk.connect()).rejects.toThrow(OstiumError);
      await expect(sdk.connect()).rejects.toThrow("Failed to connect to RPC");
    });
  });

  describe("getFormattedPairsDetails", () => {
    it("returns formatted pairs with prices", async () => {
      const mockPairs = [
        {
          id: "0",
          from: "BTC",
          to: "USD",
          feed: "0x1234",
          overnightMaxLeverage: "5000",
          longOI: "1000000000000000000",
          shortOI: "500000000000000000",
          maxOI: "10000000",
          makerFeeP: "100000",
          takerFeeP: "200000",
          makerMaxLeverage: "15000",
          curFundingLong: "50000000",
          curFundingShort: "50000000",
          curRollover: "10",
          totalOpenTrades: "42",
          totalOpenLimitOrders: "5",
          accRollover: "100",
          lastRolloverBlock: "999999",
          rolloverFeePerBlock: "1",
          accFundingLong: "200",
          accFundingShort: "200",
          lastFundingBlock: "999998",
          maxFundingFeePerBlock: "10",
          lastFundingRate: "5000000000",
          hillInflectionPoint: "500000",
          hillPosScale: "100",
          hillNegScale: "100",
          springFactor: "50",
          sFactorUpScaleP: "100",
          sFactorDownScaleP: "100",
          lastTradePrice: "107000000000000000000000",
          maxLeverage: "15000",
          group: {
            id: "0",
            name: "crypto",
            minLeverage: "200",
            maxLeverage: "10000",
            maxCollateralP: "5000",
            longCollateral: "5000000",
            shortCollateral: "5000000",
          },
          fee: { minLevPos: "1500000" },
        },
      ];
      const mockPrices = [
        { from: "BTC", to: "USD", mid: 107000, isMarketOpen: true, isDayTradingClosed: false },
      ];

      const sdk = new OstiumSDK({ network: "testnet" });
      sdk.subgraph.getPairs = vi.fn().mockResolvedValue(mockPairs);
      sdk.price.getLatestPrices = vi.fn().mockResolvedValue(mockPrices);

      const result = await sdk.getFormattedPairsDetails();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(0);
      expect(result[0].from).toBe("BTC");
      expect(result[0].group).toBe("crypto");
      expect(result[0].maxLeverage).toBe(100);
      expect(result[0].minLeverage).toBe(2);
      expect(result[0].overnightMaxLeverage).toBe(50);
      expect(result[0].price).toBe(107000);
      expect(result[0].isMarketOpen).toBe(true);
    });

    it("works without prices", async () => {
      const mockPairs = [
        {
          id: "0",
          from: "BTC",
          to: "USD",
          feed: "0x1234",
          overnightMaxLeverage: "0",
          longOI: "0",
          shortOI: "0",
          maxOI: "0",
          makerFeeP: "0",
          takerFeeP: "0",
          makerMaxLeverage: "0",
          curFundingLong: "0",
          curFundingShort: "0",
          curRollover: "0",
          totalOpenTrades: "0",
          totalOpenLimitOrders: "0",
          accRollover: "0",
          lastRolloverBlock: "0",
          rolloverFeePerBlock: "0",
          accFundingLong: "0",
          accFundingShort: "0",
          lastFundingBlock: "0",
          maxFundingFeePerBlock: "0",
          lastFundingRate: "0",
          hillInflectionPoint: "0",
          hillPosScale: "0",
          hillNegScale: "0",
          springFactor: "0",
          sFactorUpScaleP: "0",
          sFactorDownScaleP: "0",
          lastTradePrice: "0",
          maxLeverage: "15000",
          group: {
            id: "0",
            name: "crypto",
            minLeverage: "200",
            maxLeverage: "0",
            maxCollateralP: "0",
            longCollateral: "0",
            shortCollateral: "0",
          },
          fee: { minLevPos: "0" },
        },
      ];

      const sdk = new OstiumSDK({ network: "testnet" });
      sdk.subgraph.getPairs = vi.fn().mockResolvedValue(mockPairs);

      const result = await sdk.getFormattedPairsDetails(false);

      expect(result).toHaveLength(1);
      expect(result[0].maxLeverage).toBe(150);
      expect(result[0].price).toBeUndefined();
      expect(result[0].overnightMaxLeverage).toBeUndefined();
    });
  });

  it("passes logger to all sub-modules", () => {
    const logger: Logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    new OstiumSDK({ network: "testnet", privateKey: TEST_PRIVATE_KEY, logger });

    expect(PriceSpy).toHaveBeenCalledWith(logger);
    expect(SubgraphSpy).toHaveBeenCalledWith(expect.any(String), logger);
    expect(TradingSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      logger,
      undefined,
    );
  });

  it("passes builder config to trading module", () => {
    const builder = {
      address: "0xBuilderAddress0000000000000000000000000000" as const,
      feePercent: 0.1,
    };
    new OstiumSDK({ network: "testnet", privateKey: TEST_PRIVATE_KEY, builder });

    expect(TradingSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      undefined,
      builder,
    );
  });
});
