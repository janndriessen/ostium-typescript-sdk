import { GraphQLClient, gql } from "graphql-request";
import { OstiumError } from "../errors.js";
import type { Logger, OpenOrder, OpenTrade, Pair } from "../types.js";

const GET_PAIRS = gql`
  query getPairs {
    pairs(first: 1000) {
      id
      from
      to
      feed
      overnightMaxLeverage
      longOI
      shortOI
      maxOI
      makerFeeP
      takerFeeP
      makerMaxLeverage
      curFundingLong
      curFundingShort
      curRollover
      totalOpenTrades
      totalOpenLimitOrders
      accRollover
      lastRolloverBlock
      rolloverFeePerBlock
      accFundingLong
      accFundingShort
      lastFundingBlock
      maxFundingFeePerBlock
      lastFundingRate
      hillInflectionPoint
      hillPosScale
      hillNegScale
      springFactor
      sFactorUpScaleP
      sFactorDownScaleP
      lastTradePrice
      maxLeverage
      group {
        id
        name
        minLeverage
        maxLeverage
        maxCollateralP
        longCollateral
        shortCollateral
      }
      fee {
        minLevPos
      }
    }
  }
`;

const GET_PAIR_DETAILS = gql`
  query getPairDetails($pair_id: ID!) {
    pair(id: $pair_id) {
      id
      from
      to
      feed
      overnightMaxLeverage
      longOI
      shortOI
      maxOI
      makerFeeP
      takerFeeP
      makerMaxLeverage
      curFundingLong
      curFundingShort
      curRollover
      totalOpenTrades
      totalOpenLimitOrders
      accRollover
      lastRolloverBlock
      rolloverFeePerBlock
      accFundingLong
      accFundingShort
      lastFundingBlock
      maxFundingFeePerBlock
      lastFundingRate
      hillInflectionPoint
      hillPosScale
      hillNegScale
      springFactor
      sFactorUpScaleP
      sFactorDownScaleP
      lastTradePrice
      maxLeverage
      group {
        id
        name
        minLeverage
        maxLeverage
        maxCollateralP
        longCollateral
        shortCollateral
      }
      fee {
        minLevPos
      }
    }
  }
`;

const GET_OPEN_TRADES = gql`
  query trades($trader: Bytes!) {
    trades(where: { isOpen: true, trader: $trader }) {
      tradeID
      collateral
      leverage
      highestLeverage
      openPrice
      stopLossPrice
      takeProfitPrice
      isOpen
      timestamp
      isBuy
      notional
      tradeNotional
      funding
      rollover
      trader
      index
      pair {
        id
        feed
        from
        to
        accRollover
        lastRolloverBlock
        rolloverFeePerBlock
        accFundingLong
        spreadP
        accFundingShort
        longOI
        shortOI
        maxOI
        maxLeverage
        hillInflectionPoint
        hillPosScale
        hillNegScale
        springFactor
        sFactorUpScaleP
        sFactorDownScaleP
        lastFundingBlock
        maxFundingFeePerBlock
        lastFundingRate
      }
    }
  }
`;

const GET_ORDERS = gql`
  query orders($trader: Bytes!) {
    limits(
      where: { trader: $trader, isActive: true }
      orderBy: initiatedAt
      orderDirection: asc
    ) {
      collateral
      leverage
      isBuy
      isActive
      id
      openPrice
      takeProfitPrice
      stopLossPrice
      trader
      initiatedAt
      limitType
      pair {
        id
        feed
        from
        to
        accRollover
        lastRolloverBlock
        rolloverFeePerBlock
        accFundingLong
        spreadP
        accFundingShort
        longOI
        shortOI
        lastFundingBlock
        maxFundingFeePerBlock
        lastFundingRate
      }
    }
  }
`;

export class Subgraph {
  private readonly client: GraphQLClient;
  private readonly logger?: Logger;

  constructor(graphUrl: string, logger?: Logger) {
    this.client = new GraphQLClient(graphUrl);
    this.logger = logger;
  }

  async getPairs(): Promise<Pair[]> {
    this.logger?.debug("Fetching all pairs");
    const data = await this.request<{ pairs: Pair[] }>(GET_PAIRS);
    return data.pairs;
  }

  async getPairDetails(pairIndex: number): Promise<Pair | null> {
    if (!Number.isInteger(pairIndex) || pairIndex < 0 || pairIndex > 65535) {
      throw new OstiumError(`Invalid pairIndex: ${pairIndex}`, {
        suggestion: "pairIndex must be an integer between 0 and 65535",
      });
    }
    this.logger?.debug(`Fetching pair details for index ${pairIndex}`);
    const data = await this.request<{ pair: Pair | null }>(GET_PAIR_DETAILS, {
      pair_id: String(pairIndex),
    });
    return data.pair;
  }

  async getOpenTrades(address: string): Promise<OpenTrade[]> {
    this.logger?.debug(`Fetching open trades for ${address}`);
    const data = await this.request<{ trades: OpenTrade[] }>(GET_OPEN_TRADES, {
      trader: address,
    });
    return data.trades;
  }

  async getOrders(address: string): Promise<OpenOrder[]> {
    this.logger?.debug(`Fetching orders for ${address}`);
    const data = await this.request<{ limits: OpenOrder[] }>(GET_ORDERS, {
      trader: address,
    });
    return data.limits;
  }

  private async request<T>(query: string, variables?: Record<string, string>): Promise<T> {
    try {
      return await this.client.request<T>(query, variables);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      throw new OstiumError(`Subgraph query failed: ${message}`, { cause: error });
    }
  }
}
