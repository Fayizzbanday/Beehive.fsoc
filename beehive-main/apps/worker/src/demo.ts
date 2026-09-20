import { Hono } from "hono";
import {
  GOLDEN_ID,
  type CertifiedRecord,
} from "../../../packages/shared/src/index";
import { hashRecord } from "../../../packages/shared/src/canonical";
import { readAnchoredRecord } from "../../../packages/blockchain/src/index";
import type { AppEnv } from "./types";
import { authenticated, roles } from "./auth";
import { getBatchRow } from "./batches";
import { verifyBatch } from "./verify";
import { statement, ok, fail, now, audit } from "./core";
const demo = new Hono<AppEnv>();
demo.use(
  "*",
  async (c, next) => {
    if (c.env.DEMO_MODE !== "true") fail(404, "Demo controls are disabled.");
    await next();
  },
  authenticated,
  roles("admin"),
);
demo.post("/tamper/:id", async (c) => {
  const batch = await getBatchRow(c, c.req.param("id"));
  if (!batch.is_demo || batch.public_id !== GOLDEN_ID)
    fail(403, "Only the isolated golden demo record can be modified.");
  const existing = await verifyBatch(c, batch.public_id);
  if (existing.verdict !== "AUTHENTIC" && existing.verdict !== "TAMPERED")
    fail(409, "Anchor and verify the golden record before tampering.");
  const record: CertifiedRecord = JSON.parse(batch.record_json);
  record.quantity = 250;
  await statement(
    c.env,
    "UPDATE batches SET record_json=? WHERE id=?",
    JSON.stringify(record),
    batch.id,
  ).run();
  await audit(
    c,
    "Database tampering simulated",
    batch.id,
    "Controlled change: quantity 25 kg → 250 kg. Blockchain unchanged.",
    batch.producer_id,
  );
  return ok(c, await verifyBatch(c, batch.public_id));
});
demo.post("/reset/:id", async (c) => {
  const batch = await getBatchRow(c, c.req.param("id"));
  if (!batch.is_demo || batch.public_id !== GOLDEN_ID)
    fail(403, "Only the isolated golden demo record can be restored.");
  const proof = await statement(
    c.env,
    "SELECT canonical_payload FROM blockchain_proofs WHERE batch_id=?",
    batch.id,
  ).first<{ canonical_payload: string }>();
  if (!proof) fail(409, "No certified snapshot exists to restore.");
  const original: CertifiedRecord = JSON.parse(proof.canonical_payload);
  const chain = await readAnchoredRecord(c.env, batch.public_id);
  if (!chain.exists || (await hashRecord(original)) !== chain.hash)
    fail(409, "The restoration snapshot does not match the blockchain proof.");
  await c.env.DB.batch([
    statement(
      c.env,
      "UPDATE batches SET record_json=?,status='ANCHORED' WHERE id=?",
      proof.canonical_payload,
      batch.id,
    ),
    statement(
      c.env,
      "UPDATE hive_alerts SET status='RESOLVED',resolved_at=? WHERE batch_id=? AND type='TAMPER' AND status!='RESOLVED'",
      now(),
      batch.id,
    ),
  ]);
  await audit(
    c,
    "Demo record restored",
    batch.id,
    "Restored exact certified snapshot; incident history preserved.",
    batch.producer_id,
  );
  return ok(c, await verifyBatch(c, batch.public_id));
});
export default demo;
