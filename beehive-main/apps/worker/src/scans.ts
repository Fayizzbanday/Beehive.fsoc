import { Hono } from "hono";
import { z } from "zod";
import {
  scanRequestSchema,
  hiveHealth,
  type Hive,
  type ScanReport,
  type Scan,
} from "../../../packages/shared/src/index";
import {
  simulateScan,
  SCAN_ENGINE_VERSION,
  type ScanContext,
} from "../../../packages/scan-engine/src/index";
import {
  forecastReputation,
  type ForecastReview,
} from "../../../packages/scan-engine/src/forecast";
import { authenticated, roles } from "./auth";
import { statement, ok, fail, id, now, audit, producerFilter } from "./core";
import type { AppEnv } from "./types";
const MAX_FRAMES = 4;
const MAX_FRAME_BYTES = 900 * 1024;
interface ScanRow {
  id: string;
  public_id: string;
  producer_id: string;
  apiary_id: string;
  hive_id: string | null;
  mode: Scan["mode"];
  source: Scan["source"];
  capture_digest: string;
  duration_seconds: number;
  frame_count: number;
  frame_keys: string;
  score: number;
  classification: string;
  report_json: string;
  notes: string;
  created_at: string;
  hive_public_id: string | null;
  hive_name: string | null;
  apiary: string | null;
}
const scanSelect = `SELECT s.*,h.public_id as hive_public_id,h.name as hive_name,a.name as apiary FROM hive_scans s LEFT JOIN hives h ON h.id=s.hive_id LEFT JOIN apiaries a ON a.id=s.apiary_id`;
function toScan(row: ScanRow): Scan {
  return {
    id: row.id,
    publicId: row.public_id,
    mode: row.mode,
    hiveId: row.hive_id,
    hivePublicId: row.hive_public_id,
    hiveName: row.hive_name,
    apiary: row.apiary,
    source: row.source,
    captureDigest: row.capture_digest,
    durationSeconds: row.duration_seconds,
    frameCount: row.frame_count,
    storedFrames: (JSON.parse(row.frame_keys) as string[]).length,
    score: row.score,
    classification: row.classification,
    notes: row.notes,
    createdAt: row.created_at,
    report: JSON.parse(row.report_json) as ScanReport,
  };
}
/** Keyframes arrive as small JPEG/PNG stills extracted in the browser; the video itself never leaves the device. */
function validFrame(type: string, bytes: ArrayBuffer) {
  const prefix = new Uint8Array(bytes.slice(0, 4));
  return type === "image/png"
    ? prefix[0] === 137 &&
        prefix[1] === 80 &&
        prefix[2] === 78 &&
        prefix[3] === 71
    : prefix[0] === 255 && prefix[1] === 216 && prefix[2] === 255;
}
const scans = new Hono<AppEnv>();
scans.use("*", authenticated);
scans.get("/forecast", async (c) => {
  const f = producerFilter(c);
  const b = producerFilter(c, "b.producer_id");
  const [reviews, verifications, batches, alerts] = await Promise.all([
    statement(
      c.env,
      `SELECT rating,sentiment,channel,tags,verified_scan,created_at FROM consumer_reviews WHERE ${f.sql} ORDER BY created_at DESC LIMIT 400`,
      ...f.values,
    ).all<{
      rating: number;
      sentiment: string;
      channel: string;
      tags: string;
      verified_scan: number;
      created_at: string;
    }>(),
    statement(
      c.env,
      `SELECT v.verdict,v.created_at FROM verification_events v JOIN batches b ON b.id=v.batch_id WHERE ${b.sql} ORDER BY v.created_at DESC LIMIT 400`,
      ...b.values,
    ).all<{ verdict: string; created_at: string }>(),
    statement(
      c.env,
      `SELECT b.status,a.score FROM batches b LEFT JOIN ai_assessments a ON a.id=(SELECT id FROM ai_assessments WHERE batch_id=b.id ORDER BY created_at DESC LIMIT 1) WHERE ${b.sql}`,
      ...b.values,
    ).all<{ status: string; score: number | null }>(),
    statement(
      c.env,
      `SELECT COUNT(*) as count FROM hive_alerts WHERE status='OPEN' AND ${f.sql}`,
      ...f.values,
    ).first<{ count: number }>(),
  ]);
  const forecast = forecastReputation({
    reviews: reviews.results.map((r): ForecastReview => ({
      ...r,
      tags: JSON.parse(r.tags) as string[],
    })),
    verifications: verifications.results,
    batchScores: batches.results
      .map((b) => b.score)
      .filter((s): s is number => s !== null),
    openAlerts: alerts?.count ?? 0,
    anchoredShare: batches.results.length
      ? batches.results.filter((b) => b.status === "ANCHORED").length /
        batches.results.length
      : 0,
  });
  return ok(c, forecast);
});
scans.get("/reviews", async (c) => {
  const f = producerFilter(c, "r.producer_id");
  const { results } = await statement(
    c.env,
    `SELECT r.id,r.reviewer,r.channel,r.rating,r.title,r.body,r.sentiment,r.tags,r.verified_scan,r.created_at,b.public_id as batch_public_id FROM consumer_reviews r LEFT JOIN batches b ON b.id=r.batch_id WHERE ${f.sql} ORDER BY r.created_at DESC LIMIT 60`,
    ...f.values,
  ).all<{ tags: string }>();
  return ok(
    c,
    results.map((r) => ({ ...r, tags: JSON.parse(r.tags) as string[] })),
  );
});
const INBOUND_REVIEWS = [
  {
    reviewer: "Ritika S.",
    channel: "Marketplace",
    rating: 5,
    title: "Scanned the QR before opening the jar",
    body: "The passport matched the label exactly and the honey tastes like the acacia I remember from Pahalgam.",
    sentiment: "positive",
    tags: ["authenticity"],
    verified_scan: 1,
  },
  {
    reviewer: "Mohit A.",
    channel: "Retail partner",
    rating: 2,
    title: "Set solid within a fortnight",
    body: "The jar crystallised almost completely. Taste is fine after warming but it does not look like the photos.",
    sentiment: "negative",
    tags: ["crystallisation", "consistency"],
    verified_scan: 0,
  },
  {
    reviewer: "Fatima N.",
    channel: "Direct order",
    rating: 4,
    title: "Good honey, slow delivery",
    body: "Flavour and clarity are excellent. The parcel took nine days and the outer seal was sticky.",
    sentiment: "neutral",
    tags: ["delivery", "packaging"],
    verified_scan: 1,
  },
];
scans.post("/reviews/simulate", roles("producer", "admin"), async (c) => {
  if (c.env.DEMO_MODE !== "true")
    fail(404, "The review simulator is disabled.");
  const user = c.get("user");
  const producerId = user.producerId;
  if (!producerId) fail(403, "Your account is not linked to a producer.");
  const count = await statement(
    c.env,
    "SELECT COUNT(*) as count FROM consumer_reviews WHERE producer_id=?",
    producerId,
  ).first<{ count: number }>();
  const template =
    INBOUND_REVIEWS[(count?.count ?? 0) % INBOUND_REVIEWS.length];
  const batch = await statement(
    c.env,
    "SELECT id FROM batches WHERE producer_id=? AND status='ANCHORED' ORDER BY created_at DESC LIMIT 1",
    producerId,
  ).first<{ id: string }>();
  const reviewId = id();
  await statement(
    c.env,
    "INSERT INTO consumer_reviews (id,producer_id,batch_id,reviewer,channel,rating,title,body,sentiment,tags,verified_scan,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
    reviewId,
    producerId,
    batch?.id ?? null,
    template.reviewer,
    template.channel,
    template.rating,
    template.title,
    template.body,
    template.sentiment,
    JSON.stringify(template.tags),
    template.verified_scan,
    now(),
  ).run();
  await audit(
    c,
    "Consumer review received",
    reviewId,
    `${template.rating}★ ${template.channel}: ${template.title}`,
    producerId,
  );
  return ok(c, { id: reviewId, rating: template.rating }, 201);
});
scans.get("/", async (c) => {
  const f = producerFilter(c, "s.producer_id");
  const hiveId = c.req.query("hiveId");
  const mode = c.req.query("mode");
  const filters = [f.sql];
  const values: (string | number)[] = [...f.values];
  if (hiveId) {
    filters.push("(h.public_id=? OR s.hive_id=?)");
    values.push(hiveId, hiveId);
  }
  if (mode) {
    filters.push("s.mode=?");
    values.push(mode);
  }
  const { results } = await statement(
    c.env,
    `${scanSelect} WHERE ${filters.join(" AND ")} ORDER BY s.created_at DESC LIMIT 60`,
    ...values,
  ).all<ScanRow>();
  return ok(c, results.map(toScan));
});
scans.post("/", roles("producer", "admin"), async (c) => {
  const form = await c.req
    .formData()
    .catch(() => fail(422, "Send the capture as a multipart form."));
  let metadata: unknown;
  try {
    metadata = JSON.parse(String(form.get("metadata") ?? ""));
  } catch {
    fail(422, "The scan metadata field must contain valid JSON.");
  }
  const parsed = scanRequestSchema.safeParse(metadata);
  if (!parsed.success)
    fail(
      422,
      parsed.error.issues
        .map((i) => `${i.path.join(".") || "scan"}: ${i.message}`)
        .join("; "),
    );
  const input = parsed.data;
  const f = producerFilter(c);
  const apiary = await statement(
    c.env,
    `SELECT id,producer_id,name,location,latitude,longitude FROM apiaries WHERE id=? AND ${f.sql}`,
    input.apiaryId,
    ...f.values,
  ).first<{
    id: string;
    producer_id: string;
    name: string;
    location: string;
    latitude: number;
    longitude: number;
  }>();
  if (!apiary) fail(422, "Choose the apiary this scan belongs to.");
  let hive: (Hive & { producer_id: string }) | null = null;
  if (input.hiveId) {
    hive = await statement(
      c.env,
      `SELECT h.id,h.public_id,h.producer_id,h.name,h.status,h.species,h.queen_age,r.temperature,r.humidity,r.weight,r.activity FROM hives h LEFT JOIN hive_readings r ON r.id=(SELECT id FROM hive_readings WHERE hive_id=h.id ORDER BY timestamp DESC LIMIT 1) WHERE (h.id=? OR h.public_id=?) AND h.producer_id=?`,
      input.hiveId,
      input.hiveId,
      apiary.producer_id,
    ).first<Hive & { producer_id: string }>();
    if (!hive) fail(404, "Hive not found in this workspace.");
  }
  const frames = form
    .getAll("frame")
    .filter((v): v is File => v instanceof File);
  if (frames.length > MAX_FRAMES)
    fail(422, `Send at most ${MAX_FRAMES} keyframes with a capture.`);
  const scanId = id();
  const frameKeys: string[] = [];
  for (const [index, frame] of frames.entries()) {
    if (!["image/jpeg", "image/png"].includes(frame.type))
      fail(422, "Keyframes must be JPEG or PNG stills.");
    if (frame.size === 0 || frame.size > MAX_FRAME_BYTES)
      fail(422, "Each keyframe must be under 900 KB.");
    const bytes = await frame.arrayBuffer();
    if (!validFrame(frame.type, bytes))
      fail(422, "Keyframe contents do not match the declared image type.");
    const key = `scans/${apiary.producer_id}/${scanId}/${index}`;
    await c.env.BUCKET.put(key, bytes, {
      httpMetadata: { contentType: frame.type },
      customMetadata: { scanId, index: String(index) },
    });
    frameKeys.push(key);
  }
  const trend = hive
    ? await statement(
        c.env,
        "SELECT MIN(weight) as low, MAX(weight) as high, MIN(timestamp) as first, MAX(timestamp) as last FROM hive_readings WHERE hive_id=? AND timestamp>=?",
        hive.id,
        new Date(Date.now() - 7 * 86400000).toISOString(),
      ).first<{
        low: number | null;
        high: number | null;
        first: string;
        last: string;
      }>()
    : null;
  const days =
    trend?.first && trend.last
      ? Math.max(
          1,
          (Date.parse(trend.last) - Date.parse(trend.first)) / 86400000,
        )
      : 1;
  const context: ScanContext = {
    hive: hive
      ? {
          publicId: hive.public_id,
          name: hive.name,
          status: hive.status,
          healthScore: hiveHealth(hive.temperature, hive.humidity),
          temperature: hive.temperature,
          humidity: hive.humidity,
          weight: hive.weight,
          activity: hive.activity,
          species: hive.species,
          queenAge: hive.queen_age,
        }
      : null,
    apiary: {
      name: apiary.name,
      location: apiary.location,
      latitude: apiary.latitude,
      longitude: apiary.longitude,
    },
    weightTrend:
      trend?.high != null && trend.low != null
        ? Number(((trend.high - trend.low) / days).toFixed(2))
        : undefined,
    durationSeconds: input.durationSeconds,
    frameCount: input.frameCount,
  };
  const report = simulateScan(input.mode, input.captureDigest, context);
  const publicId = `SCAN-${scanId.slice(0, 8).toUpperCase()}`;
  try {
    await statement(
      c.env,
      "INSERT INTO hive_scans (id,public_id,producer_id,apiary_id,hive_id,mode,source,capture_digest,duration_seconds,frame_count,frame_keys,score,classification,report_json,engine_version,notes,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      scanId,
      publicId,
      apiary.producer_id,
      apiary.id,
      hive?.id ?? null,
      input.mode,
      input.source,
      input.captureDigest,
      input.durationSeconds,
      input.frameCount,
      JSON.stringify(frameKeys),
      report.score,
      report.classification,
      JSON.stringify(report),
      SCAN_ENGINE_VERSION,
      input.notes,
      report.timestamp,
    ).run();
  } catch (error) {
    await Promise.all(frameKeys.map((key) => c.env.BUCKET.delete(key)));
    throw error;
  }
  if (hive && report.classification === "HIGH")
    await statement(
      c.env,
      "INSERT OR IGNORE INTO hive_alerts (id,hive_id,producer_id,type,severity,title,detail,created_at) VALUES (?,?,?,'VISION_SCAN','Alert',?,?,?)",
      id(),
      hive.id,
      apiary.producer_id,
      `Vision scan flagged ${hive.public_id}`,
      `${report.title} ${report.findings[0]?.action ?? ""} Simulated prototype scan ${publicId}.`.trim(),
      now(),
    ).run();
  await audit(
    c,
    "AI vision scan completed",
    scanId,
    `${publicId} ${input.mode}: ${report.score}/100 ${report.classification}; ${SCAN_ENGINE_VERSION}`,
    apiary.producer_id,
  );
  const row = await statement(
    c.env,
    `${scanSelect} WHERE s.id=?`,
    scanId,
  ).first<ScanRow>();
  return ok(c, toScan(row!), 201);
});
scans.get("/:id", async (c) => {
  const f = producerFilter(c, "s.producer_id");
  const row = await statement(
    c.env,
    `${scanSelect} WHERE (s.id=? OR s.public_id=?) AND ${f.sql}`,
    c.req.param("id"),
    c.req.param("id"),
    ...f.values,
  ).first<ScanRow>();
  if (!row) fail(404, "Scan not found.");
  return ok(c, toScan(row));
});
scans.get("/:id/frames/:index", async (c) => {
  const f = producerFilter(c, "s.producer_id");
  const row = await statement(
    c.env,
    `SELECT s.frame_keys FROM hive_scans s WHERE (s.id=? OR s.public_id=?) AND ${f.sql}`,
    c.req.param("id"),
    c.req.param("id"),
    ...f.values,
  ).first<{ frame_keys: string }>();
  if (!row) fail(404, "Scan not found.");
  const parsedIndex = z.coerce
    .number()
    .int()
    .min(0)
    .max(MAX_FRAMES - 1)
    .safeParse(c.req.param("index"));
  const keys = JSON.parse(row.frame_keys) as string[];
  if (!parsedIndex.success || !keys[parsedIndex.data])
    fail(404, "That keyframe is not stored for this scan.");
  const object = await c.env.BUCKET.get(keys[parsedIndex.data]);
  if (!object) fail(404, "Keyframe object is missing.");
  return new Response(object.body, {
    headers: {
      "Content-Type": object.httpMetadata?.contentType ?? "image/jpeg",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
export default scans;
