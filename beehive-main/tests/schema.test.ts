import { describe, it, expect } from "vitest";
import {
  readingSchema,
  hiveHealth,
  batchSchema,
} from "../packages/shared/src/index";
describe("telemetry boundaries", () => {
  it("rejects physically impossible and non-finite readings", () => {
    for (const temperature of [-30, 90, NaN, Infinity])
      expect(
        readingSchema.safeParse({ temperature, humidity: 55, weight: 35 })
          .success,
      ).toBe(false);
  });
  it("detects hive stress", () => {
    expect(hiveHealth(34, 55)).toBeGreaterThan(90);
    expect(hiveHealth(43, 89)).toBeLessThan(50);
  });
  it("rejects missing source and invalid quantities", () => {
    expect(batchSchema.safeParse({ quantity: -10 }).success).toBe(false);
  });
});
