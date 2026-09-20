import { Hono, type Context } from "hono";
import {
  batchSchema,
  type Batch,
  type CertifiedRecord,
  type Assessment,
  type Proof,
} from "../../../packages/shared/src/index";
import type { AppEnv } from "./types";
import { authenticated, roles } from "./auth";
import {
  body,
  statement,
  ok,
  fail,
  id,
  now,
  audit,
  producerFilter,
} from "./core";
export interface BatchRow {
  id: string;
  public_id: string;
  producer_id: string;
  apiary_id: string;
  record_json: string;
  status: string;
  is_demo: number;
  notes: string;
  created_at: string;
}
export async function getBatchRow(
  c: Context<AppEnv>,
  batchId: string,
  publicAccess = false,
) {
  const f = publicAccess ? { sql: "1=1", values: [] } : producerFilter(c);
  const row = await statement(
    c.env,
    `SELECT * FROM batches WHERE (id=? OR public_id=?) AND ${f.sql}`,
    batchId,
    batchId,
    ...f.values,
  ).first<BatchRow>();
  if (!row) fail(404, "Batch not found.");
  return row;
}
export async function hydrateBatch(
  c: Context<AppEnv>,
  row: BatchRow,
): Promise<Batch> {
  const [assessment, proof] = await Promise.all([
    statement(
      c.env,
      "SELECT assessment_json FROM ai_assessments WHERE batch_id=? ORDER BY created_at DESC LIMIT 1",
      row.id,
    ).first<{ assessment_json: string }>(),
    statement(
      c.env,
      "SELECT record_hash,canonical_payload_version,blockchain_tx_hash,blockchain_network,blockchain_timestamp,block_number,chain_id,contract_address,status FROM blockchain_proofs WHERE batch_id=?",
      row.id,
    ).first<Proof>(),
  ]);
  return {
    id: row.id,
    publicId: row.public_id,
    record: JSON.parse(row.record_json),
    status: row.status,
    notes: row.notes,
    isDemo: !!row.is_demo,
    assessment: assessment ? JSON.parse(assessment.assessment_json) : null,
    proof: proof
      ? {
          ...proof,
          explorerUrl:
            c.env.BLOCK_EXPLORER_URL && proof.blockchain_tx_hash
              ? `${c.env.BLOCK_EXPLORER_URL}/tx/${proof.blockchain_tx_hash}`
              : null,
        }
      : null,
  };
}
const batches = new Hono<AppEnv>();
batches.use("*", authenticated);
batches.get("/:id/documents", async (c) => {
  const batch = await getBatchRow(c, c.req.param("id"));
  const documents = await statement(
    c.env,
    "SELECT id,filename,content_type,size,digest,kind,created_at FROM batch_documents WHERE batch_id=? ORDER BY created_at DESC LIMIT 100",
    batch.id,
  ).all();
  return ok(c, documents.results);
});
batches.get("/", async (c) => {
  const f = producerFilter(c, "b.producer_id");
  const rows = await statement(
    c.env,
    `SELECT b.*,a.assessment_json,p.record_hash,p.canonical_payload_version,p.blockchain_tx_hash,p.blockchain_network,p.blockchain_timestamp,p.block_number,p.chain_id,p.contract_address,p.status as proof_status FROM batches b LEFT JOIN ai_assessments a ON a.id=(SELECT id FROM ai_assessments WHERE batch_id=b.id ORDER BY created_at DESC LIMIT 1) LEFT JOIN blockchain_proofs p ON p.batch_id=b.id WHERE ${f.sql} ORDER BY b.created_at DESC LIMIT 500`,
    ...f.values,
  ).all<
    BatchRow & {
      assessment_json: string | null;
      record_hash: string | null;
      canonical_payload_version: string;
      blockchain_tx_hash: string | null;
      blockchain_network: string;
      blockchain_timestamp: string | null;
      block_number: string | null;
      chain_id: number;
      contract_address: string;
      proof_status: string;
    }
  >();
  return ok(
    c,
    rows.results.map((r) => ({
      id: r.id,
      publicId: r.public_id,
      record: JSON.parse(r.record_json),
      status: r.status,
      isDemo: !!r.is_demo,
      assessment: r.assessment_json ? JSON.parse(r.assessment_json) : null,
      proof: r.record_hash
        ? {
            record_hash: r.record_hash,
            canonical_payload_version: r.canonical_payload_version,
            blockchain_tx_hash: r.blockchain_tx_hash,
            blockchain_network: r.blockchain_network,
            blockchain_timestamp: r.blockchain_timestamp,
            block_number: r.block_number,
            chain_id: r.chain_id,
            contract_address: r.contract_address,
            status: r.proof_status,
          }
        : null,
    })),
  );
});
batches.post("/", roles("producer", "admin"), async (c) => {
  const input = await body(c, batchSchema);
  if (input.harvestDate > now().slice(0, 10))
    fail(422, "Harvest date cannot be in the future.");
  const f = producerFilter(c, "a.producer_id");
  const apiary = await statement(
    c.env,
    `SELECT a.*,p.name as producer_name FROM apiaries a JOIN producers p ON p.id=a.producer_id WHERE a.id=? AND ${f.sql}`,
    input.apiaryId,
    ...f.values,
  ).first<{
    id: string;
    name: string;
    producer_id: string;
    producer_name: string;
    location: string;
    latitude: number;
    longitude: number;
  }>();
  if (!apiary) fail(404, "Source apiary not found.");
  const sources = await statement(
    c.env,
    `SELECT id,public_id,installation_date FROM hives WHERE apiary_id=? AND id IN (${input.hiveIds.map(() => "?").join(",")})`,
    apiary.id,
    ...input.hiveIds,
  ).all<{ id: string; public_id: string; installation_date: string }>();
  if (sources.results.length !== input.hiveIds.length)
    fail(422, "Every source hive must belong to the selected apiary.");
  if (sources.results.some((h) => h.installation_date > input.harvestDate))
    fail(422, "Harvest cannot precede hive installation.");
  let doc: null | { digest: string; id: string } = null;
  if (input.documentId) {
    doc = await statement(
      c.env,
      "SELECT id,digest FROM batch_documents WHERE id=? AND producer_id=? AND batch_id IS NULL",
      input.documentId,
      apiary.producer_id,
    ).first();
    if (!doc)
      fail(
        422,
        "Evidence must be an unused document belonging to this producer.",
      );
  }
  const batchId = id(),
    publicId = `BH-2026-${id().replaceAll("-", "").slice(0, 12).toUpperCase()}`,
    createdAt = now();
  const record: CertifiedRecord = {
    schemaVersion: "beehive.record.v1",
    publicId,
    producerId: apiary.producer_id,
    producerName: apiary.producer_name,
    hiveIds: sources.results.map((h) => h.public_id),
    apiary: apiary.name,
    origin: {
      region: apiary.location,
      latitude: apiary.latitude,
      longitude: apiary.longitude,
    },
    honeyType: input.honeyType,
    harvestDate: input.harvestDate,
    quantity: input.quantity,
    qualityMeasurements: {
      moisture: input.moisture,
      hmf: input.labValues?.hmf ?? null,
      diastase: input.labValues?.diastase ?? null,
    },
    lotInformation: input.lotInformation,
    extractionMethod: input.extractionMethod,
    certificateDigest: doc?.digest ?? null,
    aiAssessmentDigest: null,
    createdAt,
  };
  const queries = [
    statement(
      c.env,
      "INSERT INTO batches (id,public_id,producer_id,apiary_id,record_json,lot_information,extraction_method,notes,is_demo,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
      batchId,
      publicId,
      apiary.producer_id,
      apiary.id,
      JSON.stringify(record),
      input.lotInformation,
      input.extractionMethod,
      input.notes,
      c.env.DEMO_MODE === "true" ? 1 : 0,
      createdAt,
    ),
    ...sources.results.map((h) =>
      statement(
        c.env,
        "INSERT INTO batch_hives (batch_id,hive_id) VALUES (?,?)",
        batchId,
        h.id,
      ),
    ),
  ];
  if (doc)
    queries.push(
      statement(
        c.env,
        "UPDATE batch_documents SET batch_id=? WHERE id=? AND batch_id IS NULL",
        batchId,
        doc.id,
      ),
    );
  await c.env.DB.batch(queries);
  await audit(
    c,
    "Honey batch created",
    batchId,
    `${publicId}: ${input.quantity} kg ${input.honeyType}`,
    apiary.producer_id,
  );
  return ok(c, await hydrateBatch(c, await getBatchRow(c, batchId)), 201);
});
batches.get("/:id", async (c) =>
  ok(c, await hydrateBatch(c, await getBatchRow(c, c.req.param("id")))),
);
export default batches;
