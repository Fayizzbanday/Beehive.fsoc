import { describe, it, expect } from "vitest";
import { assessRisk, classification } from "../packages/risk-engine/src/index";
import { goldenRecord } from "./fixtures";
describe("explainable hybrid screening", () => {
  it.each([
    [0, "LOW"],
    [30, "LOW"],
    [31, "MEDIUM"],
    [70, "MEDIUM"],
    [71, "HIGH"],
    [100, "HIGH"],
  ])("classifies %s as %s", (n, result) =>
    expect(classification(Number(n))).toBe(result),
  );
  it("produces a defensible golden risk of 18", () => {
    const a = assessRisk(goldenRecord, {
      now: "2026-09-06T12:00:00.000Z",
      hiveTemperature: 34,
      hiveHumidity: 55,
    });
    expect(a.score).toBe(18);
    expect(a.reasons.join(" ")).toContain("No certificate");
    expect(a.scope).toContain("does not establish honey purity");
  });
  it("flags high quantity and geographic deviation", () => {
    const a = assessRisk(
      { ...goldenRecord, quantity: 250 },
      {
        registeredOrigin: { latitude: 10, longitude: 70 },
        now: "2026-09-06T12:00:00.000Z",
      },
    );
    expect(a.classification).toBe("HIGH");
    expect(
      a.features.find((f) => f.name === "origin_distance_km")?.points,
    ).toBe(30);
  });
  it("uses statistical history", () => {
    expect(
      assessRisk(
        { ...goldenRecord, quantity: 49 },
        {
          historicalQuantities: [15, 16, 14, 17],
          now: "2026-09-06T12:00:00.000Z",
        },
      ).features.some((f) => f.name === "historical_z_score" && f.points > 0),
    ).toBe(true);
  });
});
