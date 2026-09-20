import type {
  Assessment,
  CertifiedRecord,
  RiskFeature,
} from "../../shared/src/index";
export interface RiskContext {
  historicalQuantities?: number[];
  duplicateCount?: number;
  recentSubmissions?: number;
  registeredOrigin?: { latitude: number; longitude: number };
  hiveTemperature?: number | null;
  hiveHumidity?: number | null;
  modificationCount?: number;
  now?: string;
}
export function classification(score: number): Assessment["classification"] {
  return score <= 30 ? "LOW" : score <= 70 ? "MEDIUM" : "HIGH";
}
export function assessRisk(
  record: CertifiedRecord,
  context: RiskContext = {},
): Assessment {
  const features: RiskFeature[] = [];
  const recommendations: string[] = [];
  const add = (
    name: string,
    value: RiskFeature["value"],
    points: number,
    explanation: string,
    recommendation?: string,
  ) => {
    features.push({ name, value, points, explanation });
    if (points && recommendation) recommendations.push(recommendation);
  };
  const perHive = record.quantity / Math.max(1, record.hiveIds.length);
  add(
    "quantity_per_hive",
    perHive,
    perHive > 120 ? 48 : perHive > 50 ? 24 : 0,
    perHive > 50
      ? `Reported harvest is ${perHive.toFixed(1)} kg per hive, above the prototype review threshold.`
      : "Harvest quantity is consistent with the configured source-hive range.",
    "Request yield logs and verify the weighing record.",
  );
  const moisture = record.qualityMeasurements.moisture;
  add(
    "moisture",
    moisture,
    moisture > 23 || moisture < 10 ? 25 : moisture > 20 ? 12 : 0,
    moisture > 20 || moisture < 10
      ? "Reported moisture is outside the configured screening range."
      : "Reported moisture falls within the configured screening range.",
    "Confirm moisture with a calibrated instrument and laboratory evidence.",
  );
  add(
    "evidence_missing",
    !record.certificateDigest,
    record.certificateDigest ? 0 : 10,
    record.certificateDigest
      ? "Supporting evidence is fingerprinted."
      : "No certificate is attached; measurements are producer-reported.",
    "Attach a certificate from an accredited laboratory.",
  );
  const missingLab =
    record.qualityMeasurements.hmf === null ||
    record.qualityMeasurements.diastase === null;
  add(
    "lab_values_incomplete",
    missingLab,
    missingLab ? 8 : 0,
    missingLab
      ? "Optional HMF or diastase measurements are unavailable."
      : "Optional laboratory values are supplied.",
    "Add HMF and diastase results when available.",
  );
  const temperature = context.hiveTemperature,
    humidity = context.hiveHumidity;
  const stress =
    (temperature != null && (temperature < 30 || temperature > 38)) ||
    (humidity != null && (humidity < 35 || humidity > 75));
  add(
    "hive_conditions",
    stress ? "abnormal" : temperature == null ? "unavailable" : "normal",
    stress ? 16 : 0,
    stress
      ? "Source hive conditions around harvest require attention."
      : temperature == null
        ? "No nearby hive readings are available; screening confidence is reduced."
        : "Hive conditions around harvest were within the configured range.",
    "Inspect the colony and include harvest-time observations.",
  );
  const origin = context.registeredOrigin;
  const distance = origin
    ? Math.hypot(
        (record.origin.latitude - origin.latitude) * 111,
        (record.origin.longitude - origin.longitude) *
          111 *
          Math.cos((origin.latitude * Math.PI) / 180),
      )
    : 0;
  add(
    "origin_distance_km",
    Number(distance.toFixed(2)),
    distance > 50 ? 30 : 0,
    distance > 50
      ? "Batch origin differs materially from the registered apiary."
      : "Registered apiary location matches batch origin.",
    "Verify the source location and transport evidence.",
  );
  const duplicates = context.duplicateCount ?? 0;
  add(
    "duplicate_records",
    duplicates,
    duplicates > 0 ? 20 : 0,
    duplicates
      ? "Source, harvest date, quantity and honey type match another batch."
      : "No duplicate record patterns detected.",
    "Confirm this lot is distinct from prior submissions.",
  );
  const recent = context.recentSubmissions ?? 0;
  add(
    "submission_velocity",
    recent,
    recent >= 5 ? 10 : 0,
    recent >= 5
      ? "Several batches were submitted within ten minutes."
      : "Submission frequency is within the review threshold.",
    "Review repeated submissions for accidental duplication.",
  );
  const history = context.historicalQuantities ?? [];
  if (history.length >= 3) {
    const mean = history.reduce((a, b) => a + b, 0) / history.length;
    const deviation = Math.sqrt(
      history.reduce((a, b) => a + (b - mean) ** 2, 0) / history.length,
    );
    const z = (record.quantity - mean) / Math.max(5, deviation);
    add(
      "historical_z_score",
      Number(z.toFixed(2)),
      z > 4 ? 18 : z > 2.5 ? 8 : 0,
      z > 2.5
        ? "Production quantity deviates from this producer’s recent history."
        : "Production quantity follows the producer’s recent pattern.",
      "Compare this harvest with seasonal yield history.",
    );
  }
  const timestamp = context.now ?? new Date().toISOString();
  const harvest = Date.parse(record.harvestDate);
  const invalidDate =
    !Number.isFinite(harvest) || harvest > Date.parse(timestamp);
  add(
    "harvest_timing",
    record.harvestDate,
    invalidDate ? 40 : 0,
    invalidDate
      ? "Harvest timing is invalid or in the future."
      : "Harvest timing is internally consistent.",
    "Correct the harvest date before certification.",
  );
  const invalid =
    record.quantity <= 0 ||
    !Number.isFinite(record.quantity) ||
    moisture < 0 ||
    moisture > 100 ||
    !Number.isFinite(moisture) ||
    record.hiveIds.length === 0;
  add(
    "invalid_values",
    invalid,
    invalid ? 100 : 0,
    invalid
      ? "The record contains impossible or missing values."
      : "Required metadata is present and numerically valid.",
    "Correct invalid metadata.",
  );
  const modifications = context.modificationCount ?? 0;
  add(
    "modification_history",
    modifications,
    modifications > 0 ? 20 : 0,
    modifications
      ? "The record has a modification history requiring review."
      : "No suspicious modification history detected.",
    "Review the audit trail before relying on this record.",
  );
  const score = Math.min(
    100,
    features.reduce((sum, f) => sum + f.points, 0),
  );
  return {
    score,
    classification: classification(score),
    confidence: Number(
      (
        0.64 +
        (history.length >= 3 ? 0.1 : 0) +
        (temperature != null ? 0.1 : 0) +
        (record.certificateDigest ? 0.08 : 0)
      ).toFixed(2),
    ),
    reasons: [
      ...features.filter((f) => f.points > 0),
      ...features.filter((f) => f.points === 0),
    ].map((f) => f.explanation),
    recommendations: recommendations.length
      ? recommendations
      : ["Continue routine hive monitoring and preserve supporting evidence."],
    features,
    version: "beehive.hybrid-rules.v1",
    timestamp,
    scope:
      "Metadata risk and anomaly screening. This assessment does not establish honey purity, safety or laboratory quality.",
  };
}
