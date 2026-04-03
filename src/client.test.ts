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
    it("throws in read-only mode", async () => {
      const sdk = new OstiumSDK({ network: "testnet" });
      await expect(sdk.connect()).rejects.toThrow(OstiumError);
      await expect(sdk.connect()).rejects.toThrow("privateKey");
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
