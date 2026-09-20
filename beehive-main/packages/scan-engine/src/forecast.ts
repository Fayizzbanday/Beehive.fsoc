import type {
  ForecastDriver,
  ReputationForecast,
} from "../../shared/src/index";
import { classification } from "../../risk-engine/src/index";
export const FORECAST_VERSION = "beehive.market-signal.v1";
export interface ForecastReview {
  rating: number;
  sentiment: string;
  channel: string;
  tags: string[];
  verified_scan: number;
  created_at: string;
}
export interface ForecastInput {
  reviews: ForecastReview[];
  verifications: { verdict: string; created_at: string }[];
  batchScores: number[];
  openAlerts: number;
  anchoredShare: number;
  now?: string;
}
const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));
const round = (value: number, places = 1) => Number(value.toFixed(places)) + 0;
const mean = (values: number[]) =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
const COMPLAINTS: Record<string, { label: string; severity: string }> = {
  crystallisation: { label: "Crystallised on arrival", severity: "Low" },
  taste: { label: "Taste not as described", severity: "Medium" },
  packaging: { label: "Packaging and leakage", severity: "Medium" },
  delivery: { label: "Late or damaged delivery", severity: "Low" },
  authenticity: { label: "Doubts about authenticity", severity: "High" },
  labelling: { label: "Label and origin clarity", severity: "Medium" },
  price: { label: "Price versus quantity", severity: "Low" },
  consistency: { label: "Batch-to-batch consistency", severity: "Medium" },
};
/**
 * Market-signal risk forecast. Unlike the video scan modes this uses no capture at all:
 * it scores what consumers reported, what verifiers saw, and what the batch risk engine
 * already decided. The output predicts reputational exposure; it never asserts purity.
 */
export function forecastReputation(input: ForecastInput): ReputationForecast {
  const now = input.now ?? new Date().toISOString();
  const nowMs = Date.parse(now);
  const reviews = [...input.reviews].sort((a, b) =>
    a.created_at < b.created_at ? 1 : -1,
  );
  const age = (value: string) => (nowMs - Date.parse(value)) / 86400000;
  const recent = reviews.filter((r) => age(r.created_at) <= 30);
  const prior = reviews.filter(
    (r) => age(r.created_at) > 30 && age(r.created_at) <= 90,
  );
  const averageRating = round(mean(reviews.map((r) => r.rating)), 2);
  const ratingTrend = round(
    mean(recent.map((r) => r.rating)) - mean(prior.map((r) => r.rating)),
    2,
  );
  const negative = reviews.filter((r) => r.rating <= 2).length;
  const neutral = reviews.filter((r) => r.rating === 3).length;
  const positive = reviews.filter((r) => r.rating >= 4).length;
  const negativeShare = reviews.length ? negative / reviews.length : 0;
  const verifiedShare = reviews.length
    ? reviews.filter((r) => r.verified_scan).length / reviews.length
    : 0;
  const counts = new Map<string, number>();
  for (const review of reviews)
    if (review.rating <= 3)
      for (const tag of review.tags)
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
  const complaints = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag, count]) => ({
      tag,
      label: COMPLAINTS[tag]?.label ?? tag,
      count,
      share: round((count / Math.max(1, reviews.length)) * 100),
      severity: COMPLAINTS[tag]?.severity ?? "Medium",
    }));
  const channels = [...new Set(reviews.map((r) => r.channel))]
    .map((channel) => {
      const rows = reviews.filter((r) => r.channel === channel);
      return {
        channel,
        count: rows.length,
        averageRating: round(mean(rows.map((r) => r.rating)), 2),
      };
    })
    .sort((a, b) => b.count - a.count);
  const tampered = input.verifications.filter(
    (v) => v.verdict === "TAMPERED",
  ).length;
  const authenticChecks = input.verifications.filter(
    (v) => v.verdict === "AUTHENTIC",
  ).length;
  const tamperShare = input.verifications.length
    ? tampered / input.verifications.length
    : 0;
  const batchRisk = mean(input.batchScores);
  const authenticityComplaints =
    complaints.find((c) => c.tag === "authenticity")?.count ?? 0;
  const drivers: ForecastDriver[] = [
    {
      key: "rating_level",
      label: "Consumer rating level",
      impact: Math.round(clamp((4.6 - averageRating) * 13, 0, 34)),
      direction: averageRating >= 4.3 ? "down" : "up",
      detail: `${averageRating || "No"} average across ${reviews.length} reviews in the last 12 months.`,
    },
    {
      key: "rating_trend",
      label: "30-day rating movement",
      impact: Math.round(clamp(-ratingTrend * 16, 0, 22)),
      direction: ratingTrend >= 0 ? "down" : "up",
      detail: `Recent reviews average ${ratingTrend >= 0 ? "+" : ""}${ratingTrend} against the previous 60 days.`,
    },
    {
      key: "negative_share",
      label: "Share of one and two-star reviews",
      impact: Math.round(clamp(negativeShare * 100 * 0.62, 0, 24)),
      direction: negativeShare <= 0.08 ? "down" : "up",
      detail: `${negative} of ${reviews.length} reviews rate the product at two stars or below.`,
    },
    {
      key: "complaint_cluster",
      label: "Dominant complaint cluster",
      impact: Math.round(clamp((complaints[0]?.share ?? 0) * 0.55, 0, 16)),
      direction: (complaints[0]?.share ?? 0) < 10 ? "down" : "up",
      detail: complaints[0]
        ? `${complaints[0].label} appears in ${complaints[0].share}% of reviews.`
        : "No recurring complaint theme in the review corpus.",
    },
    {
      key: "authenticity_doubt",
      label: "Authenticity doubt in reviews",
      impact: Math.round(clamp(authenticityComplaints * 7, 0, 20)),
      direction: authenticityComplaints ? "up" : "down",
      detail: authenticityComplaints
        ? `${authenticityComplaints} reviews question whether the honey is genuine.`
        : "No consumer questioned the authenticity of a batch.",
    },
    {
      key: "integrity_events",
      label: "Integrity verification events",
      // Any tampered verification costs a floor of 8; beyond that the share of checks that failed carries it.
      impact: tampered ? Math.round(clamp(8 + tamperShare * 35, 8, 30)) : 0,
      direction: tampered ? "up" : "down",
      detail: tampered
        ? `${tampered} of ${input.verifications.length} public verifications returned TAMPERED.`
        : `${authenticChecks} public verifications returned AUTHENTIC.`,
    },
    {
      key: "batch_risk",
      label: "Certified batch risk",
      impact: Math.round(clamp(batchRisk * 0.22, 0, 18)),
      direction: batchRisk <= 30 ? "down" : "up",
      detail: `Batch screening averages ${Math.round(batchRisk)} / 100 across analysed harvests.`,
    },
    {
      key: "open_alerts",
      label: "Unresolved alerts",
      impact: Math.round(clamp(input.openAlerts * 3, 0, 12)),
      direction: input.openAlerts ? "up" : "down",
      detail: `${input.openAlerts} hive or batch alert${input.openAlerts === 1 ? "" : "s"} remain open.`,
    },
    {
      key: "proof_coverage",
      label: "Blockchain proof coverage",
      impact: -Math.round(clamp(input.anchoredShare * 12, 0, 12)),
      direction: "down",
      detail: `${Math.round(input.anchoredShare * 100)}% of batches carry an anchored fingerprint a buyer can verify.`,
    },
    {
      key: "verified_buyers",
      label: "Reviews from verified scans",
      impact: -Math.round(clamp(verifiedShare * 10, 0, 10)),
      direction: "down",
      detail: `${Math.round(verifiedShare * 100)}% of reviewers scanned the QR passport before reviewing.`,
    },
  ];
  const score = Math.round(
    clamp(
      drivers.reduce((sum, d) => sum + d.impact, 0) +
        (reviews.length < 10 ? 8 : 0),
      2,
      98,
    ),
  );
  const drift = clamp(
    -ratingTrend * 6 + negativeShare * 14 - input.anchoredShare * 5,
    -14,
    16,
  );
  const projection = [30, 60, 90].map((horizonDays) => ({
    horizonDays,
    score: Math.round(clamp(score + (drift * horizonDays) / 60, 2, 98)),
    label:
      horizonDays === 30
        ? "Next month at the current review pace"
        : horizonDays === 60
          ? "If the dominant complaint is not addressed"
          : "Late-season outlook including festival demand",
  }));
  const monthly = Array.from({ length: 6 }, (_, index) => {
    const offset = 5 - index;
    const start = new Date(nowMs);
    start.setUTCMonth(start.getUTCMonth() - offset, 1);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1);
    const rows = reviews.filter((r) => {
      const t = Date.parse(r.created_at);
      return t >= start.getTime() && t < end.getTime();
    });
    const monthRating = round(mean(rows.map((r) => r.rating)), 2);
    return {
      month: start.toISOString().slice(0, 7),
      reviews: rows.length,
      averageRating: monthRating,
      score: rows.length
        ? Math.round(clamp((5 - monthRating) * 22, 2, 98))
        : score,
    };
  });
  const recommendations = [
    complaints[0]
      ? `Address “${complaints[0].label}” first — it drives ${complaints[0].share}% of reviews and ${drivers[3].impact} points of this score.`
      : "Keep collecting reviews; the corpus is too small for a confident complaint cluster.",
    tampered
      ? "Publish the authority review outcome for the tampered record so buyers see it was caught and handled."
      : "Print the QR passport on every jar — verified scans reduce authenticity doubt measurably.",
    averageRating < 4.3
      ? "Follow up with two and three-star reviewers on the batches they name; most cite a fixable handling issue."
      : "Feature the anchored proof in listings; high-rating buyers cite traceability as the reason they repurchase.",
  ];
  return {
    score,
    classification: classification(score),
    confidence: round(
      clamp(
        0.5 +
          Math.min(0.32, reviews.length * 0.006) +
          (input.verifications.length ? 0.08 : 0),
        0.4,
        0.92,
      ),
      2,
    ),
    reviewCount: reviews.length,
    averageRating,
    ratingTrend,
    sentimentSplit: { positive, neutral, negative },
    verifiedShare: round(verifiedShare * 100),
    drivers: drivers
      .filter((d) => d.impact !== 0)
      .sort((a, b) => b.impact - a.impact),
    complaints,
    channels,
    projection,
    monthly,
    signals: [
      {
        label: "Public verifications",
        value: String(input.verifications.length),
        detail: `${authenticChecks} authentic · ${tampered} tampered`,
      },
      {
        label: "Proof coverage",
        value: `${Math.round(input.anchoredShare * 100)}%`,
        detail: "Batches with an anchored fingerprint",
      },
      {
        label: "Average batch risk",
        value: `${Math.round(batchRisk)} / 100`,
        detail: "From the certified-record risk engine",
      },
      {
        label: "Open alerts",
        value: String(input.openAlerts),
        detail: "Hive and batch cases awaiting action",
      },
    ],
    recommendations,
    version: FORECAST_VERSION,
    timestamp: now,
    scope:
      "Reputational and market-risk forecast built from consumer reviews, public verification events and certified batch screening. It predicts commercial exposure, not honey purity, and is never anchored on-chain.",
  };
}
