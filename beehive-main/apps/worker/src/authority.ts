import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "./types";
import { authenticated, roles } from "./auth";
import { statement, body, ok, fail, id, now, audit } from "./core";
const authority = new Hono<AppEnv>();
authority.use("*", authenticated, roles("authority", "admin"));
export const alertQuery = `SELECT a.*,p.name as producer_name,b.public_id,s.score FROM hive_alerts a JOIN producers p ON p.id=a.producer_id LEFT JOIN batches b ON b.id=a.batch_id LEFT JOIN ai_assessments s ON s.id=(SELECT id FROM ai_assessments WHERE batch_id=b.id ORDER BY created_at DESC LIMIT 1)`;
authority.get("/alerts", async (c) =>
  ok(
    c,
    (
      await statement(
        c.env,
        `${alertQuery} ORDER BY CASE a.status WHEN 'OPEN' THEN 0 WHEN 'REVIEWED' THEN 1 ELSE 2 END,a.created_at DESC LIMIT 500`,
      ).all()
    ).results,
  ),
);
authority.get("/records", async (c) =>
  ok(
    c,
    (
      await statement(
        c.env,
        `SELECT b.public_id,b.status,b.created_at,p.name as producer,a.score,a.classification,json_extract(b.record_json,'$.honeyType') as honey_type,json_extract(b.record_json,'$.quantity') as quantity,(SELECT verdict FROM verification_events WHERE batch_id=b.id ORDER BY created_at DESC LIMIT 1) as integrity FROM batches b JOIN producers p ON p.id=b.producer_id LEFT JOIN ai_assessments a ON a.id=(SELECT id FROM ai_assessments WHERE batch_id=b.id ORDER BY created_at DESC LIMIT 1) ORDER BY b.created_at DESC LIMIT 500`,
      ).all()
    ).results,
  ),
);
authority.get("/overview", async (c) => {
  const [metrics, risk, activity, trend, records, queue] = await Promise.all([
    statement(
      c.env,
      `SELECT (SELECT COUNT(*) FROM batches) as totalRecords,(SELECT COUNT(*) FROM batches WHERE status='ANCHORED') as anchoredRecords,(SELECT COUNT(*) FROM batches b WHERE (SELECT verdict FROM verification_events WHERE batch_id=b.id ORDER BY created_at DESC LIMIT 1)='AUTHENTIC') as verifiedRecords,(SELECT COUNT(*) FROM ai_assessments a WHERE score>70 AND id=(SELECT id FROM ai_assessments WHERE batch_id=a.batch_id ORDER BY created_at DESC LIMIT 1)) as highRiskRecords,(SELECT COUNT(*) FROM hive_alerts WHERE status='OPEN') as activeAlerts,(SELECT COUNT(*) FROM hive_alerts WHERE type='TAMPER') as tamperingIncidents,(SELECT COUNT(*) FROM producers) as registeredProducers`,
    ).first(),
    statement(
      c.env,
      "SELECT classification as name,COUNT(*) as count FROM ai_assessments a WHERE id=(SELECT id FROM ai_assessments WHERE batch_id=a.batch_id ORDER BY created_at DESC LIMIT 1) GROUP BY classification",
    ).all(),
    statement(
      c.env,
      "SELECT substr(created_at,1,10) as name,COUNT(*) as count FROM verification_events GROUP BY name ORDER BY name DESC LIMIT 14",
    ).all(),
    statement(
      c.env,
      "SELECT substr(created_at,1,10) as name,COUNT(*) as count FROM hive_alerts GROUP BY name ORDER BY name DESC LIMIT 14",
    ).all(),
    statement(
      c.env,
      "SELECT substr(created_at,1,10) as name,COUNT(*) as count FROM batches GROUP BY name ORDER BY name DESC LIMIT 14",
    ).all(),
    statement(
      c.env,
      `${alertQuery} WHERE a.status='OPEN' ORDER BY CASE a.type WHEN 'TAMPER' THEN 0 ELSE 1 END,s.score DESC,a.created_at DESC LIMIT 8`,
    ).all(),
  ]);
  return ok(c, {
    metrics,
    risk: risk.results,
    activity: activity.results.reverse(),
    trend: trend.results.reverse(),
    records: records.results.reverse(),
    queue: queue.results,
  });
});
authority.post("/alerts/:id/review", async (c) => {
  const { decision, notes } = await body(
    c,
    z
      .object({
        decision: z.enum(["REVIEWED", "RESOLVED"]),
        notes: z.string().trim().min(8).max(2000),
      })
      .strict(),
  );
  const alert = await statement(
    c.env,
    "SELECT id,producer_id FROM hive_alerts WHERE id=?",
    c.req.param("id"),
  ).first<{ id: string; producer_id: string }>();
  if (!alert) fail(404, "Alert not found.");
  await c.env.DB.batch([
    statement(
      c.env,
      "INSERT INTO authority_reviews (id,alert_id,reviewer_id,decision,notes,created_at) VALUES (?,?,?,?,?,?)",
      id(),
      alert.id,
      c.get("user").id,
      decision,
      notes,
      now(),
    ),
    statement(
      c.env,
      "UPDATE hive_alerts SET status=?,resolved_at=? WHERE id=?",
      decision,
      decision === "RESOLVED" ? now() : null,
      alert.id,
    ),
  ]);
  await audit(
    c,
    "Authority review recorded",
    alert.id,
    `${decision}: ${notes}`,
    alert.producer_id,
  );
  return ok(c, { reviewed: true });
});
export default authority;
