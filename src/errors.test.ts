import { describe, expect, it } from "vitest";
import { OstiumError } from "./errors.js";

describe("OstiumError", () => {
  it("sets message and name", () => {
    const err = new OstiumError("something went wrong");
    expect(err.message).toBe("something went wrong");
    expect(err.name).toBe("OstiumError");
  });

  it("is an instance of Error", () => {
    const err = new OstiumError("fail");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(OstiumError);
  });

  it("preserves all optional fields", () => {
    const cause = new Error("root cause");
    const err = new OstiumError("trade failed", {
      code: "INSUFFICIENT_COLLATERAL",
      cause,
      suggestion: "Increase collateral amount",
    });

    expect(err.code).toBe("INSUFFICIENT_COLLATERAL");
    expect(err.cause).toBe(cause);
    expect(err.suggestion).toBe("Increase collateral amount");
  });

  it("defaults optional fields to undefined", () => {
    const err = new OstiumError("bare error");
    expect(err.code).toBeUndefined();
    expect(err.cause).toBeUndefined();
    expect(err.suggestion).toBeUndefined();
  });
});
