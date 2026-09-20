import { z } from "zod";
import type { CertifiedRecord } from "./index";
const text = z.string();
const num = z.number().finite();
const digest = z
  .string()
  .regex(/^0x[a-f0-9]{64}$/)
  .nullable();
export const certifiedRecordSchema = z
  .object({
    schemaVersion: z.literal("beehive.record.v1"),
    publicId: text,
    producerId: text,
    producerName: text,
    hiveIds: z.array(text).min(1),
    apiary: text,
    origin: z
      .object({
        region: text,
        latitude: num.min(-90).max(90),
        longitude: num.min(-180).max(180),
      })
      .strict(),
    honeyType: text,
    harvestDate: z.iso.date(),
    quantity: num.positive(),
    qualityMeasurements: z
      .object({
        moisture: num.min(0).max(100),
        hmf: num.nullable(),
        diastase: num.nullable(),
      })
      .strict(),
    lotInformation: text,
    extractionMethod: text,
    certificateDigest: digest,
    aiAssessmentDigest: digest,
    createdAt: z.iso.datetime({ offset: true }),
  })
  .strict();
/** BeeHive canonical JSON v1: schema-limited, Unicode NFC, collapsed text whitespace,
 * sorted object keys, explicit nulls, finite ECMAScript numbers (including -0 -> 0),
 * UTC millisecond instants, ISO calendar dates, hive IDs treated as a sorted set.
 * Other array order is significant. Undefined, unknown fields and duplicate hive IDs reject.
 * No numeric rounding: every represented certified numeric change alters the payload. */
export function canonicalJson(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string")
    return JSON.stringify(value.normalize("NFC").trim().replace(/\s+/gu, " "));
  if (typeof value === "number") {
    if (!Number.isFinite(value))
      throw new Error("Non-finite numbers cannot be certified");
    return JSON.stringify(Object.is(value, -0) ? 0 : value);
  }
  if (typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (
    typeof value === "object" &&
    Object.getPrototypeOf(value) === Object.prototype
  ) {
    const obj = value as Record<string, unknown>;
    return `{${Object.keys(obj)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`)
      .join(",")}}`;
  }
  throw new Error("Unsupported canonical JSON value");
}
export function canonicalizeRecord(input: CertifiedRecord): string {
  const parsed = certifiedRecordSchema.parse(input);
  const hiveIds = parsed.hiveIds
    .map((s) => s.normalize("NFC").trim().replace(/\s+/gu, " "))
    .sort();
  if (new Set(hiveIds).size !== hiveIds.length)
    throw new Error("Duplicate source hives cannot be certified");
  return canonicalJson({
    ...parsed,
    hiveIds,
    createdAt: new Date(parsed.createdAt).toISOString(),
  });
}
export async function sha256(
  value: string | ArrayBuffer,
): Promise<`0x${string}`> {
  const data =
    typeof value === "string" ? new TextEncoder().encode(value) : value;
  const bytes = await crypto.subtle.digest("SHA-256", data);
  return `0x${Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("")}`;
}
export const hashRecord = (record: CertifiedRecord) =>
  sha256(canonicalizeRecord(record));
export function integrityVerdict(
  currentHash: string,
  anchoredHash: string | null,
  confirmed: boolean,
  revoked = false,
): "AUTHENTIC" | "TAMPERED" | "PENDING" | "REVOKED" {
  if (revoked) return "REVOKED";
  if (!confirmed || !anchoredHash) return "PENDING";
  return currentHash === anchoredHash ? "AUTHENTIC" : "TAMPERED";
}
