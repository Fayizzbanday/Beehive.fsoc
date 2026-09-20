import { Hono, type Context } from "hono";
import type { AppEnv } from "./types";
import type {
  CertifiedRecord,
  Verification,
  Assessment,
} from "../../../packages/shared/src/index";
import { PUBLIC_ID } from "../../../packages/shared/src/index";
import {
  hashRecord,
  canonicalJson,
  sha256,
  integrityVerdict,
} from "../../../packages/shared/src/canonical";
import { readAnchoredRecord } from "../../../packages/blockchain/src/index";
import { statement, ok, id, now } from "./core";
import { hydrateBatch, type BatchRow } from "./batches";
export async function verifyBatch(
  c: Context<AppEnv>,
  publicId: string,
): Promise<Verification> {
  const checkedAt = now();
  const row = await statement(
    c.env,
    "SELECT * FROM batches WHERE public_id=?",
    publicId,
  ).first<BatchRow>();
  if (!row)
    return {
      verdict: "NOT_FOUND",
      publicId,
      checkedAt,
      message: "No BeeHive record was found for this batch ID.",
    };
  const batch = await hydrateBatch(c, row);
  let currentHash: string;
  let schemaValid = true;
  try {
    currentHash = await hashRecord(batch.record);
  } catch {
    schemaValid = false;
    currentHash = await sha256(row.record_json);
  }
  let anchoredHash: string | null = null,
    chainAvailable = false,
    confirmed = false;
  try {
    const chain = await readAnchoredRecord(c.env, publicId);
    chainAvailable = true;
    if (chain.exists) {
      anchoredHash = chain.hash;
      confirmed = true;
    }
  } catch {
    /* A network outage never becomes an authentic verdict. */
  }
  let verdict = integrityVerdict(
    currentHash,
    anchoredHash,
    confirmed,
    row.status === "REVOKED",
  );
  if (confirmed && !schemaValid && verdict !== "REVOKED") verdict = "TAMPERED";
  // Assessment evidence is committed by digest inside the certified record.
  if (
    confirmed &&
    batch.record.aiAssessmentDigest &&
    (!batch.assessment ||
      batch.record.aiAssessmentDigest !==
        (await sha256(canonicalJson(batch.assessment))))
  )
    verdict = verdict === "REVOKED" ? "REVOKED" : "TAMPERED";
  const timeline = await statement(
    c.env,
    "SELECT action,created_at FROM audit_logs WHERE entity_id=? AND action IN ('Honey batch created','AI analysis completed','Blockchain transaction broadcast','Blockchain anchoring confirmed','Batch QR generated','Demo record restored','Database tampering simulated') ORDER BY created_at",
    row.id,
  ).all<{ action: string; created_at: string }>();
  const queries = [
    statement(
      c.env,
      "INSERT INTO verification_events (id,batch_id,verdict,current_hash,anchored_hash,created_at) VALUES (?,?,?,?,?,?)",
      id(),
      row.id,
      verdict,
      currentHash,
      anchoredHash,
      checkedAt,
    ),
  ];
  if (verdict === "TAMPERED")
    queries.push(
      statement(
        c.env,
        "INSERT OR IGNORE INTO hive_alerts (id,batch_id,producer_id,type,severity,title,detail,created_at) VALUES (?,?,?,'TAMPER','Alert',?,?,?)",
        id(),
        row.id,
        row.producer_id,
        `Integrity mismatch: ${publicId}`,
        "Current certified data or assessment differs from the immutable blockchain fingerprint.",
        checkedAt,
      ),
    );
  await c.env.DB.batch(queries);
  return {
    verdict,
    publicId,
    record: batch.record,
    assessment: batch.assessment,
    proof: batch.proof,
    currentHash,
    anchoredHash,
    checkedAt,
    chainAvailable,
    timeline: timeline.results,
    message:
      verdict === "AUTHENTIC"
        ? "The current record matches the fingerprint registered on the blockchain."
        : verdict === "TAMPERED"
          ? "The certified record has changed. Its current fingerprint does not match the immutable proof."
          : verdict === "REVOKED"
            ? "This record has been revoked."
            : chainAvailable
              ? "This record is awaiting blockchain registration."
              : "The blockchain could not be reached. Integrity has not been confirmed.",
  };
}
const verify = new Hono<AppEnv>();
verify.get("/:publicId", async (c) => {
  const publicId = c.req.param("publicId");
  if (!PUBLIC_ID.test(publicId))
    return ok(c, {
      verdict: "NOT_FOUND",
      publicId,
      checkedAt: now(),
      message: "Enter a valid BeeHive batch ID.",
    } satisfies Verification);
  return ok(c, await verifyBatch(c, publicId));
});
export default verify;
