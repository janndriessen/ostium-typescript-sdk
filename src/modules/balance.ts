import { type Address, isAddress, type PublicClient } from "viem";
import { usdcAbi } from "../abi/usdc.js";
import { OstiumError } from "../errors.js";
import type { Logger } from "../types.js";

/**
 * Read-only USDC and native ETH balance queries.
 *
 * Available whenever the SDK has RPC access — does not require a
 * `privateKey`. All methods return raw onchain values as `bigint`;
 * use viem's `formatUnits` / `formatEther` for display.
 *
 * @example
 * ```ts
 * import { formatUnits, formatEther } from "viem";
 *
 * const sdk = new OstiumSDK({ network: "mainnet" });
 * const { usdc, eth } = await sdk.balance.getBalances("0x...");
 * console.log(`${formatUnits(usdc, 6)} USDC, ${formatEther(eth)} ETH`);
 * ```
 */
export class Balance {
  private readonly publicClient: PublicClient;
  private readonly usdcAddress: Address;
  private readonly logger?: Logger;

  constructor(publicClient: PublicClient, usdcAddress: Address, logger?: Logger) {
    this.publicClient = publicClient;
    this.usdcAddress = usdcAddress;
    this.logger = logger;
  }

  /**
   * Read the USDC balance for an address.
   *
   * Returns the raw onchain value with 6-decimal precision, **not** a
   * formatted number. For display, wrap with viem's `formatUnits(value, 6)`.
   *
   * @param address - Ethereum address to query. Validated at runtime via
   *                  viem's `isAddress`; a cast-bypassed invalid value
   *                  will throw `OstiumError("Invalid address: ...")`
   *                  before any RPC call is made.
   * @returns The USDC balance in base units (1 USDC = `1_000_000n`).
   * @throws {OstiumError} If the address is invalid, or if the underlying
   *                       RPC call fails. In the RPC-failure case the
   *                       original error is preserved on `error.cause`.
   */
  async getUsdc(address: Address): Promise<bigint> {
    if (!isAddress(address)) {
      throw new OstiumError(`Invalid address: ${address}`, {
        suggestion: "address must be a valid Ethereum address",
      });
    }
    this.logger?.debug(`Fetching USDC balance for ${address}`);
    try {
      return await this.publicClient.readContract({
        address: this.usdcAddress,
        abi: usdcAbi,
        functionName: "balanceOf",
        args: [address],
      });
    } catch (error) {
      throw new OstiumError("getUsdc failed", { cause: error });
    }
  }

  /**
   * Read the native ETH balance for an address.
   *
   * Returns the raw onchain value in wei (18 decimals). For display,
   * wrap with viem's `formatEther(value)`.
   *
   * @param address - Ethereum address to query. Validated at runtime via
   *                  viem's `isAddress`.
   * @returns The ETH balance in wei (1 ETH = `1_000_000_000_000_000_000n`).
   * @throws {OstiumError} If the address is invalid, or if the underlying
   *                       RPC call fails. The original error is preserved
   *                       on `error.cause` for the RPC-failure case.
   */
  async getEth(address: Address): Promise<bigint> {
    if (!isAddress(address)) {
      throw new OstiumError(`Invalid address: ${address}`, {
        suggestion: "address must be a valid Ethereum address",
      });
    }
    this.logger?.debug(`Fetching ETH balance for ${address}`);
    try {
      return await this.publicClient.getBalance({ address });
    } catch (error) {
      throw new OstiumError("getEth failed", { cause: error });
    }
  }

  /**
   * Read USDC and native ETH balances for an address in a single call.
   *
   * Dispatches both underlying RPC requests in parallel via `Promise.all`.
   * Prefer this over calling `getUsdc` and `getEth` sequentially when you
   * need both; use the primitives directly if you only need one.
   *
   * @param address - Ethereum address to query.
   * @returns Object with `usdc` (6-decimal base units) and `eth` (wei).
   * @throws {OstiumError} If the address is invalid, or if either RPC
   *                       call fails. Failures from either primitive
   *                       propagate unchanged; `Promise.all` rejects on
   *                       the first error, so a partial result is never
   *                       returned.
   */
  async getBalances(address: Address): Promise<{ usdc: bigint; eth: bigint }> {
    const [usdc, eth] = await Promise.all([this.getUsdc(address), this.getEth(address)]);
    return { usdc, eth };
  }
}
