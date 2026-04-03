import { describe, expect, it } from "vitest";
import {
  mainnetConfig,
  OstiumError,
  OstiumSDK,
  Price,
  Subgraph,
  Trading,
  testnetConfig,
} from "./index.js";

describe("barrel exports", () => {
  it("exports all public classes", () => {
    expect(OstiumSDK).toBeDefined();
    expect(Price).toBeDefined();
    expect(Subgraph).toBeDefined();
    expect(Trading).toBeDefined();
    expect(OstiumError).toBeDefined();
  });

  it("exports network configs", () => {
    expect(mainnetConfig).toBeDefined();
    expect(testnetConfig).toBeDefined();
  });
});
