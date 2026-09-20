import type { CertifiedRecord } from "../packages/shared/src/index";
export const goldenRecord: CertifiedRecord = {
  schemaVersion: "beehive.record.v1",
  publicId: "BH-2026-000042",
  producerId: "producer-mountain",
  producerName: "Mountain Gold Apiary",
  hiveIds: ["HIVE-0042"],
  apiary: "Lidder Valley Apiary",
  origin: { region: "Jammu & Kashmir", latitude: 33.999, longitude: 75.315 },
  honeyType: "Acacia",
  harvestDate: "2026-09-05",
  quantity: 25,
  qualityMeasurements: { moisture: 17.8, hmf: null, diastase: null },
  lotInformation: "MG-SEP-042",
  extractionMethod: "Cold extraction",
  certificateDigest: null,
  aiAssessmentDigest: null,
  createdAt: "2026-09-06T08:00:00.000Z",
};
