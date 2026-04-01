export const tradingStorageAbi = [
  {
    type: "function",
    name: "getOpenLimitOrder",
    stateMutability: "view",
    inputs: [
      { name: "_trader", type: "address" },
      { name: "_pairIndex", type: "uint16" },
      { name: "_index", type: "uint8" },
    ],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "collateral", type: "uint256" },
          { name: "targetPrice", type: "uint192" },
          { name: "tp", type: "uint192" },
          { name: "sl", type: "uint192" },
          { name: "trader", type: "address" },
          { name: "leverage", type: "uint32" },
          { name: "createdAt", type: "uint32" },
          { name: "lastUpdated", type: "uint32" },
          { name: "pairIndex", type: "uint16" },
          { name: "orderType", type: "uint8" },
          { name: "index", type: "uint8" },
          { name: "buy", type: "bool" },
        ],
      },
    ],
  },
] as const;
