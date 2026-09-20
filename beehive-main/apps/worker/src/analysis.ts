import { Hono } from "hono";
import type { AppEnv } from "./types";
import type { CertifiedRecord } from "../../../packages/shared/src/index";
import { assessRisk } from "../../../packages/risk-engine/src/index";
import { canonicalJson, sha256 } from "../../../packages/shared/src/canonical";
import { authenticated, roles } from "./auth";
import { getBatchRow, hydrateBatch } from "./batches";
import { statement, ok, fail, id, now, audit } from "./core";
const analysis = new Hono<AppEnv>();
analysis.use("*", authenticated, roles("producer", "admin"));
analysis.post("/:id/analyze", async (c) => {
  const batch = await getBatchRow(c, c.req.param("id"));
  if (batch.status !== "DRAFT") return ok(c, await hydrateBatch(c, batch));
  const record: CertifiedRecord = JSON.parse(batch.record_json);
  const [history, duplicates, recent, apiary, readings] = await Promise.all([
    statement(
      c.env,
      "SELECT json_extract(record_json,'$.quantity') as quantity FROM batches WHERE producer_id=? AND id!=? AND created_at<? ORDER BY created_at DESC LIMIT 30",
      batch.producer_id,
      batch.id,
      batch.created_at,
    ).all<{ quantity: number }>(),
    statement(
      c.env,
      "SELECT COUNT(*) as count FROM batches WHERE id!=? AND apiary_id=? AND json_extract(record_json,'$.harvestDate')=? AND json_extract(record_json,'$.honeyType')=? AND json_extract(record_json,'$.quantity')=?",
      batch.id,
      batch.apiary_id,
      record.harvestDate,
      record.honeyType,
      record.quantity,
    ).first<{ count: number }>(),
    statement(
      c.env,
      "SELECT COUNT(*) as count FROM batches WHERE producer_id=? AND id!=? AND created_at>=?",
      batch.producer_id,
      batch.id,
      new Date(Date.parse(batch.created_at) - 600000).toISOString(),
    ).first<{ count: number }>(),
    statement(
      c.env,
      "SELECT latitude,longitude FROM apiaries WHERE id=?",
      batch.apiary_id,
    ).first<{ latitude: number; longitude: number }>(),
    statement(
      c.env,
      "SELECT AVG(r.temperature) as temperature, AVG(r.humidity) as humidity FROM hive_readings r JOIN batch_hives bh ON bh.hive_id=r.hive_id WHERE bh.batch_id=? AND r.timestamp>=? AND r.timestamp<=?",
      batch.id,
      `${record.harvestDate}T00:00:00.000Z`,
      `${record.harvestDate}T23:59:59.999Z`,
    ).first<{ temperature: number | null; humidity: number | null }>(),
  ]);
  const assessment = assessRisk(record, {
    historicalQuantities: history.results.map((h) => h.quantity),
    duplicateCount: duplicates?.count,
    recentSubmissions: recent?.count,
    registeredOrigin: apiary ?? undefined,
    hiveTemperature: readings?.temperature,
    hiveHumidity: readings?.humidity,
  });
  const digest = await sha256(canonicalJson(assessment));
  record.aiAssessmentDigest = digest;
  // The INSERT and state transition share a D1 transaction. A concurrent second analysis inserts nothing.
  const assessmentId = id();
  await c.env.DB.batch([
    statement(
      c.env,
      "INSERT INTO ai_assessments (id,batch_id,score,classification,assessment_json,digest,created_at) SELECT ?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM batches WHERE id=? AND status='DRAFT')",
      assessmentId,
      batch.id,
      assessment.score,
      assessment.classification,
      JSON.stringify(assessment),
      digest,
      assessment.timestamp,
      batch.id,
    ),
    statement(
      c.env,
      "UPDATE batches SET record_json=?,status='ANALYZED' WHERE id=? AND status='DRAFT'",
      JSON.stringify(record),
      batch.id,
    ),
  ]);
  if (assessment.score > 70)
    await statement(
      c.env,
      "INSERT OR IGNORE INTO hive_alerts (id,batch_id,producer_id,type,severity,title,detail,created_at) VALUES (?,?,?,'RISK','Alert',?,?,?)",
      id(),
      batch.id,
      batch.producer_id,
      `High-risk batch: ${batch.public_id}`,
      assessment.reasons.filter((_, i) => i < 3).join(" "),
      now(),
    ).run();
  await audit(
    c,
    "AI analysis completed",
    batch.id,
    `${assessment.score}/100 ${assessment.classification}; ${assessment.version}`,
    batch.producer_id,
  );
  return ok(c, await hydrateBatch(c, await getBatchRow(c, batch.id)));
});
export default analysis;
