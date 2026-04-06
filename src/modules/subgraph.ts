import { GraphQLClient, gql } from "graphql-request";
import { isAddress } from "viem";
import { OstiumError } from "../errors.js";
import type {
  Logger,
  OpenOrder,
  OpenTrade,
  Order,
  Pair,
  TrackOrderOptions,
  TrackOrderResult,
  Trade,
} from "../types.js";

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

const GET_ORDER_BY_ID = gql`
  query getOrder($order_id: ID!) {
    orders(where: { id: $order_id }) {
      id
      trader
      pair {
        id
        from
        to
        feed
      }
      tradeID
      limitID
      orderType
      orderAction
      price
      priceAfterImpact
      priceImpactP
      collateral
      notional
      tradeNotional
      profitPercent
      totalProfitPercent
      amountSentToTrader
      isBuy
      initiatedAt
      executedAt
      initiatedTx
      executedTx
      initiatedBlock
      executedBlock
      leverage
      isPending
      isCancelled
      cancelReason
      devFee
      vaultFee
      oracleFee
      liquidationFee
      fundingFee
      rolloverFee
      closePercent
    }
  }
`;

const GET_TRADE_BY_ID = gql`
  query getTrade($trade_id: ID!) {
    trades(where: { id: $trade_id }) {
      id
      trader
      pair {
        id
        from
        to
        feed
      }
      index
      tradeID
      tradeType
      openPrice
      closePrice
      takeProfitPrice
      stopLossPrice
      collateral
      notional
      tradeNotional
      highestLeverage
      leverage
      isBuy
      isOpen
      closeInitiated
      funding
      rollover
      timestamp
    }
  }
`;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
    if (!isAddress(address)) {
      throw new OstiumError(`Invalid address: ${address}`, {
        suggestion: "address must be a valid Ethereum address",
      });
    }
    this.logger?.debug(`Fetching open trades for ${address}`);
    const data = await this.request<{ trades: OpenTrade[] }>(GET_OPEN_TRADES, {
      trader: address,
    });
    return data.trades;
  }

  async getOrders(address: string): Promise<OpenOrder[]> {
    if (!isAddress(address)) {
      throw new OstiumError(`Invalid address: ${address}`, {
        suggestion: "address must be a valid Ethereum address",
      });
    }
    this.logger?.debug(`Fetching orders for ${address}`);
    const data = await this.request<{ limits: OpenOrder[] }>(GET_ORDERS, {
      trader: address,
    });
    return data.limits;
  }

  async getOrderById(orderId: string): Promise<Order | null> {
    if (!orderId?.trim()) {
      throw new OstiumError("Invalid orderId: empty string", {
        suggestion: "orderId must be a non-empty string",
      });
    }
    this.logger?.debug(`Fetching order ${orderId}`);
    const data = await this.request<{ orders: Order[] }>(GET_ORDER_BY_ID, {
      order_id: orderId,
    });
    return data.orders[0] ?? null;
  }

  async getTradeById(tradeId: string): Promise<Trade | null> {
    if (!tradeId?.trim()) {
      throw new OstiumError("Invalid tradeId: empty string", {
        suggestion: "tradeId must be a non-empty string",
      });
    }
    this.logger?.debug(`Fetching trade ${tradeId}`);
    const data = await this.request<{ trades: Trade[] }>(GET_TRADE_BY_ID, {
      trade_id: tradeId,
    });
    return data.trades[0] ?? null;
  }

  async trackOrder(orderId: string, options?: TrackOrderOptions): Promise<TrackOrderResult> {
    const intervalMs = options?.intervalMs ?? 1000;
    const maxAttempts = options?.maxAttempts ?? 30;

    this.logger?.info(`Tracking order ${orderId}`);

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const order = await this.getOrderById(orderId);

      if (!order || order.isPending) {
        this.logger?.debug(
          `Attempt ${attempt}/${maxAttempts}: ${order ? "pending" : "not indexed yet"}`,
        );
        if (attempt < maxAttempts) await sleep(intervalMs);
        continue;
      }

      if (order.isCancelled) {
        this.logger?.info(`Order ${orderId} cancelled: ${order.cancelReason ?? "unknown"}`);
        return { order, trade: null };
      }

      const trade = await this.getTradeById(order.tradeID);

      if (!trade) {
        this.logger?.debug(`Attempt ${attempt}/${maxAttempts}: trade not indexed yet`);
        if (attempt < maxAttempts) await sleep(intervalMs);
        continue;
      }

      this.logger?.info(`Order ${orderId} fulfilled`);
      return { order, trade };
    }

    throw new OstiumError(`Order ${orderId} not resolved after ${maxAttempts} attempts`, {
      suggestion: "Increase maxAttempts or check the order status manually",
    });
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
