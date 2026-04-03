import { OstiumError } from "../errors.js";
import type { Logger, PriceData } from "../types.js";

const PRICES_URL = "https://metadata-backend.ostium.io/PricePublish/latest-prices";

export class Price {
  private readonly logger?: Logger;

  constructor(logger?: Logger) {
    this.logger = logger;
  }

  async getLatestPrices(): Promise<PriceData[]> {
    this.logger?.debug("Fetching latest prices");

    try {
      const response = await fetch(PRICES_URL);
      if (!response.ok) {
        throw new OstiumError(`Failed to fetch prices: ${response.status} ${response.statusText}`);
      }

      return response.json() as Promise<PriceData[]>;
    } catch (error) {
      if (error instanceof OstiumError) throw error;
      throw new OstiumError("Failed to fetch prices", { cause: error });
    }
  }

  async getPrice(from: string, to: string): Promise<PriceData> {
    this.logger?.debug(`Getting price for ${from}/${to}`);

    const prices = await this.getLatestPrices();
    const match = prices.find((p) => p.from === from && p.to === to);

    if (!match) {
      throw new OstiumError(`No price found for pair: ${from}/${to}`, {
        suggestion: "Check available pairs with getLatestPrices()",
      });
    }

    return match;
  }
}
