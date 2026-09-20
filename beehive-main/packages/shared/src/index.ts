import { z } from "zod";
export const PUBLIC_ID = /^BH-2026-[A-Z0-9]{6,12}$/;
export const roleSchema = z.enum(["producer", "authority", "admin"]);
export type Role = z.infer<typeof roleSchema>;
export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  producerId: string | null;
}
export const readingSchema = z
  .object({
    temperature: z.number().finite().min(-20).max(80),
    humidity: z.number().finite().min(0).max(100),
    weight: z.number().finite().min(0).max(500),
    activity: z.number().min(0).max(100).nullable().optional(),
    timestamp: z.iso.datetime().optional(),
  })
  .strict();
export const hiveSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    apiaryId: z.string().min(1).max(80),
    species: z.enum(["Apis mellifera", "Apis cerana indica"]),
    queenAge: z.number().int().min(0).max(60),
    installationDate: z.iso.date(),
  })
  .strict();
export const batchSchema = z
  .object({
    apiaryId: z.string().min(1).max(80),
    hiveIds: z
      .array(z.string().min(1).max(80))
      .min(1)
      .max(20)
      .refine(
        (ids) => new Set(ids).size === ids.length,
        "Source hives must be unique",
      ),
    harvestDate: z.iso.date(),
    honeyType: z.enum([
      "Acacia",
      "Multiflora",
      "Mustard",
      "Eucalyptus",
      "Wildflower",
      "Litchi",
    ]),
    quantity: z.number().finite().positive().max(10000),
    moisture: z.number().finite().min(0).max(100),
    labValues: z
      .object({
        hmf: z.number().min(0).max(1000).nullable(),
        diastase: z.number().min(0).max(1000).nullable(),
      })
      .optional(),
    lotInformation: z.string().trim().min(1).max(120),
    extractionMethod: z.enum([
      "Cold extraction",
      "Centrifugal extraction",
      "Gravity filtration",
    ]),
    documentId: z.string().max(80).nullable().optional(),
    notes: z.string().trim().max(2000).default(""),
  })
  .strict();
export type BatchInput = z.infer<typeof batchSchema>;
export interface CertifiedRecord {
  schemaVersion: "beehive.record.v1";
  publicId: string;
  producerId: string;
  producerName: string;
  hiveIds: string[];
  apiary: string;
  origin: { region: string; latitude: number; longitude: number };
  honeyType: string;
  harvestDate: string;
  quantity: number;
  qualityMeasurements: {
    moisture: number;
    hmf: number | null;
    diastase: number | null;
  };
  lotInformation: string;
  extractionMethod: string;
  certificateDigest: string | null;
  aiAssessmentDigest: string | null;
  createdAt: string;
}
export interface RiskFeature {
  name: string;
  value: number | string | boolean;
  points: number;
  explanation: string;
}
export interface Assessment {
  score: number;
  classification: "LOW" | "MEDIUM" | "HIGH";
  confidence: number;
  reasons: string[];
  recommendations: string[];
  features: RiskFeature[];
  version: string;
  timestamp: string;
  scope: string;
}
export interface Reading {
  id: string;
  hive_id: string;
  temperature: number;
  humidity: number;
  weight: number;
  activity: number | null;
  timestamp: string;
}
export interface Hive {
  id: string;
  public_id: string;
  name: string;
  apiary_id: string;
  apiary: string;
  location: string;
  latitude: number;
  longitude: number;
  species: string;
  queen_age: number;
  installation_date: string;
  status: "Healthy" | "Watch" | "Alert";
  temperature: number | null;
  humidity: number | null;
  weight: number | null;
  activity: number | null;
  timestamp: string | null;
  healthScore: number;
}
export interface Proof {
  record_hash: string;
  canonical_payload_version: string;
  blockchain_tx_hash: string | null;
  blockchain_network: string;
  blockchain_timestamp: string | null;
  block_number: string | null;
  chain_id: number;
  contract_address: string;
  status: string;
  explorerUrl?: string | null;
}
export interface Batch {
  id: string;
  publicId: string;
  record: CertifiedRecord;
  status: string;
  assessment: Assessment | null;
  proof: Proof | null;
  isDemo: boolean;
  notes?: string;
}
export interface BatchDocument {
  id: string;
  filename: string;
  content_type: string;
  size: number;
  digest: string;
  kind: string;
  created_at: string;
}
export interface Alert {
  id: string;
  hive_id: string | null;
  batch_id: string | null;
  type: string;
  severity: string;
  title: string;
  detail: string;
  status: string;
  created_at: string;
  producer_name: string;
  public_id: string | null;
  score: number | null;
}
export interface Verification {
  verdict: "AUTHENTIC" | "TAMPERED" | "PENDING" | "REVOKED" | "NOT_FOUND";
  publicId: string;
  record?: CertifiedRecord;
  assessment?: Assessment | null;
  proof?: Proof | null;
  currentHash?: string;
  anchoredHash?: string | null;
  checkedAt: string;
  chainAvailable?: boolean;
  message: string;
  timeline?: { action: string; created_at: string }[];
}
export type ApiResult<T> =
  | { success: true; data: T; requestId: string }
  | {
      success: false;
      error: { code: string; message: string };
      requestId: string;
    };
export const GOLDEN_ID = "BH-2026-000042";
export const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
export function hiveHealth(t: number | null, h: number | null) {
  if (t === null || h === null) return 0;
  return Math.max(
    12,
    Math.min(
      98,
      Math.round(
        98 -
          Math.abs(t - 34) * 5 -
          Math.max(0, h - 65) * 1.3 -
          Math.max(0, 40 - h),
      ),
    ),
  );
}
export const SCAN_MODES = [
  "HONEY_QUALITY",
  "ENVIRONMENT",
  "DISEASE",
  "DIGITAL_TWIN",
] as const;
export const scanModeSchema = z.enum(SCAN_MODES);
export type ScanMode = (typeof SCAN_MODES)[number];
export const scanRequestSchema = z
  .object({
    mode: scanModeSchema,
    apiaryId: z.string().min(1).max(80),
    hiveId: z.string().min(1).max(80).nullable().default(null),
    source: z.enum(["camera", "upload"]),
    captureDigest: z.string().regex(/^0x[a-f0-9]{64}$/),
    durationSeconds: z.number().finite().min(0.4).max(900),
    frameCount: z.number().int().min(1).max(8),
    notes: z.string().trim().max(500).default(""),
  })
  .strict()
  .refine(
    (value) => value.mode === "ENVIRONMENT" || !!value.hiveId,
    "Choose the hive this scan belongs to.",
  );
export type ScanRequest = z.infer<typeof scanRequestSchema>;
export interface ScanMetric {
  key: string;
  label: string;
  value: number;
  unit: string;
  band: "good" | "watch" | "poor";
  detail: string;
  benchmark?: string;
}
export interface ScanFinding {
  id: string;
  title: string;
  severity: "INFO" | "WATCH" | "ACTION";
  confidence: number;
  detail: string;
  action: string;
  frame: number;
  region: { x: number; y: number; width: number; height: number };
}
export interface TwinFrame {
  index: number;
  role: "BROOD" | "HONEY" | "POLLEN" | "EMPTY";
  coverage: number;
  capped: number;
}
export interface DigitalTwin {
  boxes: number;
  frames: number;
  occupiedFrames: number;
  combCoverage: number;
  population: number;
  broodAreaCm2: number;
  honeyStores: number;
  pollenStores: number;
  queenStatus: string;
  estimatedWeight: number;
  sensorWeight: number | null;
  weightDelta: number | null;
  weight: { component: string; kilograms: number }[];
  frameMap: TwinFrame[];
  projections: {
    horizonDays: number;
    expectedWeight: number;
    expectedYield: number;
    riskScore: number;
    note: string;
  }[];
  expectedDiseases: {
    name: string;
    probability: number;
    window: string;
    trigger: string;
  }[];
}
export interface PlacementSpot {
  id: string;
  label: string;
  suitability: number;
  orientation: string;
  distanceMeters: number;
  rationale: string;
  x: number;
  y: number;
}
export interface PlacementReport {
  suitability: number;
  orientation: string;
  sunlightHours: number;
  carryingCapacity: number;
  recommendedSpots: PlacementSpot[];
  cautions: string[];
}
export interface ScanReport {
  mode: ScanMode;
  score: number;
  classification: "LOW" | "MEDIUM" | "HIGH";
  confidence: number;
  headline: { label: string; value: number; unit: string };
  title: string;
  summary: string;
  metrics: ScanMetric[];
  findings: ScanFinding[];
  recommendations: string[];
  twin?: DigitalTwin;
  placement?: PlacementReport;
  frames: { index: number; timeOffset: number; label: string; focus: number }[];
  engine: string;
  timestamp: string;
  scope: string;
  simulated: true;
}
export interface Scan {
  id: string;
  publicId: string;
  mode: ScanMode;
  hiveId: string | null;
  hivePublicId: string | null;
  hiveName: string | null;
  apiary: string | null;
  source: "camera" | "upload";
  captureDigest: string;
  durationSeconds: number;
  frameCount: number;
  storedFrames: number;
  score: number;
  classification: string;
  notes: string;
  createdAt: string;
  report: ScanReport;
}
export interface ConsumerReview {
  id: string;
  batch_public_id: string | null;
  reviewer: string;
  channel: string;
  rating: number;
  title: string;
  body: string;
  sentiment: string;
  tags: string[];
  verified_scan: number;
  created_at: string;
}
export interface ForecastDriver {
  key: string;
  label: string;
  impact: number;
  direction: "up" | "down";
  detail: string;
}
export interface ReputationForecast {
  score: number;
  classification: "LOW" | "MEDIUM" | "HIGH";
  confidence: number;
  reviewCount: number;
  averageRating: number;
  ratingTrend: number;
  sentimentSplit: { positive: number; neutral: number; negative: number };
  verifiedShare: number;
  drivers: ForecastDriver[];
  complaints: {
    tag: string;
    label: string;
    count: number;
    share: number;
    severity: string;
  }[];
  channels: { channel: string; count: number; averageRating: number }[];
  projection: { horizonDays: number; score: number; label: string }[];
  monthly: {
    month: string;
    reviews: number;
    averageRating: number;
    score: number;
  }[];
  signals: { label: string; value: string; detail: string }[];
  recommendations: string[];
  version: string;
  timestamp: string;
  scope: string;
}
export const SCAN_MODE_LABELS: Record<
  ScanMode,
  { title: string; tagline: string; needsHive: boolean }
> = {
  HONEY_QUALITY: {
    title: "Honey & comb scan",
    tagline: "Capping, moisture, colour and harvest readiness from the frame.",
    needsHive: true,
  },
  ENVIRONMENT: {
    title: "Environment & placement scan",
    tagline: "Where the next hive stand should go, and what to fix first.",
    needsHive: false,
  },
  DISEASE: {
    title: "Disease & pest scan",
    tagline: "Mite load, brood pattern and early disease signatures.",
    needsHive: true,
  },
  DIGITAL_TWIN: {
    title: "Digital twin",
    tagline: "Structure, weight, stores and a 90-day risk projection.",
    needsHive: true,
  },
};
