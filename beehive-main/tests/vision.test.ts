import { describe, it, expect } from "vitest";
import {
  simulateScan,
  SCAN_ENGINE_VERSION,
  type ScanContext,
} from "../packages/scan-engine/src/index";
import { forecastReputation } from "../packages/scan-engine/src/forecast";
import { SCAN_MODES } from "../packages/shared/src/index";
const digest = `0x${"9f".repeat(32)}`;
const context: ScanContext = {
  hive: {
    publicId: "HIVE-0042",
    name: "Acacia ridge",
    status: "Healthy",
    healthScore: 88,
    temperature: 34.1,
    humidity: 56,
    weight: 38.4,
    activity: 82,
    species: "Apis mellifera",
    queenAge: 10,
  },
  apiary: {
    name: "Lidder Valley Apiary",
    location: "Jammu & Kashmir",
    latitude: 33.999,
    longitude: 75.315,
  },
  durationSeconds: 11.4,
  frameCount: 4,
  now: "2026-09-06T09:00:00.000Z",
};
describe("simulated vision scans", () => {
  it.each(SCAN_MODES)("returns a bounded, explainable %s report", (mode) => {
    const report = simulateScan(mode, digest, context);
    expect(report.score).toBeGreaterThanOrEqual(0);
    expect(report.score).toBeLessThanOrEqual(100);
    expect(report.classification).toBe(
      report.score <= 30 ? "LOW" : report.score <= 70 ? "MEDIUM" : "HIGH",
    );
    expect(report.metrics.length).toBeGreaterThan(2);
    expect(report.findings.length).toBeGreaterThan(0);
    expect(report.recommendations.length).toBeGreaterThan(0);
    expect(report.frames).toHaveLength(context.frameCount);
    expect(report.engine).toBe(SCAN_ENGINE_VERSION);
    expect(report.simulated).toBe(true);
    expect(report.scope).toContain("not a diagnostic instrument");
    for (const finding of report.findings) {
      expect(finding.frame).toBeLessThan(context.frameCount);
      expect(finding.confidence).toBeLessThanOrEqual(1);
      expect(finding.region.x + finding.region.width).toBeLessThanOrEqual(1);
      expect(finding.region.y + finding.region.height).toBeLessThanOrEqual(1);
    }
  });
  it("is deterministic per capture and distinct per mode", () => {
    const first = simulateScan("DISEASE", digest, context);
    const again = simulateScan("DISEASE", digest, context);
    const other = simulateScan("DISEASE", `0x${"1a".repeat(32)}`, context);
    expect(again).toEqual(first);
    expect(other.score).not.toBe(first.score);
    expect(simulateScan("HONEY_QUALITY", digest, context).summary).not.toBe(
      first.summary,
    );
  });
  it("grounds the digital twin in the hive's own load-cell reading", () => {
    const twin = simulateScan("DIGITAL_TWIN", digest, context).twin!;
    expect(twin.sensorWeight).toBe(38.4);
    expect(twin.weightDelta).toBe(
      Number((twin.estimatedWeight - 38.4).toFixed(1)),
    );
    expect(twin.frameMap).toHaveLength(twin.frames);
    expect(twin.occupiedFrames).toBeLessThanOrEqual(twin.frames);
    expect(twin.projections.map((p) => p.horizonDays)).toEqual([30, 60, 90]);
    expect(twin.expectedDiseases.length).toBeGreaterThan(0);
    const summed = twin.weight.reduce((sum, part) => sum + part.kilograms, 0);
    expect(Math.abs(summed - twin.estimatedWeight)).toBeLessThan(0.3);
  });
  it("reads a stressed colony as higher disease pressure", () => {
    const stressed = simulateScan("DISEASE", digest, {
      ...context,
      hive: { ...context.hive!, healthScore: 32, status: "Alert" },
    });
    expect(stressed.score).toBeGreaterThan(
      simulateScan("DISEASE", digest, context).score,
    );
  });
  it("recommends a placement without requiring a hive", () => {
    const placement = simulateScan("ENVIRONMENT", digest, {
      ...context,
      hive: null,
    }).placement!;
    expect(placement.recommendedSpots).toHaveLength(3);
    expect(placement.recommendedSpots[0].suitability).toBe(
      placement.suitability,
    );
    expect(placement.cautions.length).toBeGreaterThan(0);
  });
});
describe("market risk forecast", () => {
  const review = (
    rating: number,
    daysAgo: number,
    tags: string[] = [],
    verified = 0,
  ) => ({
    rating,
    sentiment: rating >= 4 ? "positive" : rating === 3 ? "neutral" : "negative",
    channel: "Marketplace",
    tags,
    verified_scan: verified,
    created_at: new Date(
      Date.parse("2026-09-06T09:00:00.000Z") - daysAgo * 86400000,
    ).toISOString(),
  });
  const now = "2026-09-06T09:00:00.000Z";
  it("scores a trusted producer as low risk", () => {
    const forecast = forecastReputation({
      reviews: [
        ...Array.from({ length: 20 }, (_, i) => review(5, i * 4, [], 1)),
        ...Array.from({ length: 6 }, (_, i) => review(4, 10 + i * 5, [], 1)),
      ],
      verifications: Array.from({ length: 30 }, () => ({
        verdict: "AUTHENTIC",
        created_at: now,
      })),
      batchScores: [18, 22, 14],
      openAlerts: 0,
      anchoredShare: 1,
      now,
    });
    expect(forecast.classification).toBe("LOW");
    expect(forecast.averageRating).toBeGreaterThan(4.5);
    expect(forecast.drivers.some((d) => d.impact < 0)).toBe(true);
    expect(forecast.scope).toContain("not honey purity");
  });
  it("raises the score when complaints cluster and a record was tampered", () => {
    const forecast = forecastReputation({
      reviews: [
        ...Array.from({ length: 12 }, (_, i) =>
          review(1, i * 2, ["authenticity", "taste"]),
        ),
        ...Array.from({ length: 8 }, (_, i) =>
          review(2, 40 + i, ["crystallisation"]),
        ),
        ...Array.from({ length: 4 }, (_, i) => review(5, 70 + i)),
      ],
      verifications: [{ verdict: "TAMPERED", created_at: now }],
      batchScores: [82, 74],
      openAlerts: 3,
      anchoredShare: 0.2,
      now,
    });
    expect(forecast.classification).toBe("HIGH");
    expect(forecast.complaints[0].tag).toBe("authenticity");
    expect(forecast.drivers[0].impact).toBeGreaterThan(0);
    expect(forecast.projection).toHaveLength(3);
    expect(forecast.monthly).toHaveLength(6);
  });
  it("stays defined with no reviews at all", () => {
    const forecast = forecastReputation({
      reviews: [],
      verifications: [],
      batchScores: [],
      openAlerts: 0,
      anchoredShare: 0,
      now,
    });
    expect(forecast.reviewCount).toBe(0);
    expect(Number.isFinite(forecast.score)).toBe(true);
    expect(forecast.complaints).toEqual([]);
  });
});
