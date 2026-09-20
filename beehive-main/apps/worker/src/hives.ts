import { Hono } from "hono";
import { z } from "zod";
import {
  hiveSchema,
  readingSchema,
  hiveHealth,
  type Hive,
  type Reading,
} from "../../../packages/shared/src/index";
import { authenticated, roles, digest, constantEqual } from "./auth";
import {
  statement,
  body,
  ok,
  fail,
  id,
  now,
  audit,
  producerFilter,
} from "./core";
import type { AppEnv } from "./types";
import type { Context } from "hono";
const hiveSelect = `SELECT h.id,h.public_id,h.producer_id,h.name,h.apiary_id,a.name as apiary,a.location,a.latitude,a.longitude,h.species,h.queen_age,h.installation_date,h.status,r.temperature,r.humidity,r.weight,r.activity,r.timestamp FROM hives h JOIN apiaries a ON a.id=h.apiary_id LEFT JOIN hive_readings r ON r.id=(SELECT id FROM hive_readings WHERE hive_id=h.id ORDER BY timestamp DESC LIMIT 1)`;
export async function getHive(c: Context<AppEnv>, hiveId: string) {
  const f = producerFilter(c, "h.producer_id");
  const row = await statement(
    c.env,
    `${hiveSelect} WHERE (h.id=? OR h.public_id=?) AND ${f.sql}`,
    hiveId,
    hiveId,
    ...f.values,
  ).first<Hive & { producer_id: string }>();
  if (!row) fail(404, "Hive not found.");
  return { ...row, healthScore: hiveHealth(row.temperature, row.humidity) };
}
export async function addReading(
  c: Context<AppEnv>,
  hiveId: string,
  producerId: string,
  input: z.infer<typeof readingSchema>,
) {
  const timestamp = input.timestamp ?? now();
  if (new Date(timestamp).getTime() > Date.now() + 300000)
    fail(422, "Reading timestamp cannot be in the future.");
  if (new Date(timestamp).getTime() < Date.now() - 31 * 86400000)
    fail(422, "Reading timestamp must be within the last 31 days.");
  const score = hiveHealth(input.temperature, input.humidity);
  const status = score < 55 ? "Alert" : score < 80 ? "Watch" : "Healthy";
  const reading = {
    id: id(),
    hive_id: hiveId,
    ...input,
    activity: input.activity ?? null,
    timestamp,
  };
  const queries = [
    statement(
      c.env,
      "INSERT INTO hive_readings (id,hive_id,temperature,humidity,weight,activity,timestamp) VALUES (?,?,?,?,?,?,?)",
      reading.id,
      hiveId,
      input.temperature,
      input.humidity,
      input.weight,
      input.activity ?? null,
      timestamp,
    ),
    statement(
      c.env,
      "UPDATE hives SET status=? WHERE id=? AND ? >= COALESCE((SELECT MAX(timestamp) FROM hive_readings WHERE hive_id=?),?)",
      status,
      hiveId,
      timestamp,
      hiveId,
      timestamp,
    ),
  ];
  if (status !== "Healthy")
    queries.push(
      statement(
        c.env,
        "INSERT OR IGNORE INTO hive_alerts (id,hive_id,producer_id,type,severity,title,detail,created_at) VALUES (?,?,?,'HIVE_STRESS',?,?,?,?)",
        id(),
        hiveId,
        producerId,
        status,
        `Hive conditions need attention`,
        `${input.temperature}°C, ${input.humidity}% humidity. Inspect ventilation, shade and water.`,
        now(),
      ),
    );
  await c.env.DB.batch(queries);
  return { ...reading, status, healthScore: score };
}
const hives = new Hono<AppEnv>();
hives.use("*", authenticated);
hives.get("/", async (c) => {
  const f = producerFilter(c, "h.producer_id");
  const { results } = await statement(
    c.env,
    `${hiveSelect} WHERE ${f.sql} ORDER BY h.public_id`,
    ...f.values,
  ).all<Hive>();
  return ok(
    c,
    results.map((h) => ({
      ...h,
      healthScore: hiveHealth(h.temperature, h.humidity),
    })),
  );
});
hives.post("/", roles("producer", "admin"), async (c) => {
  const input = await body(c, hiveSchema);
  const f = producerFilter(c);
  const apiary = await statement(
    c.env,
    `SELECT * FROM apiaries WHERE id=? AND ${f.sql}`,
    input.apiaryId,
    ...f.values,
  ).first<{ producer_id: string }>();
  if (!apiary) fail(404, "Apiary not found.");
  if (input.installationDate > now().slice(0, 10))
    fail(422, "Installation date cannot be in the future.");
  const hiveId = id(),
    publicId = `HIVE-${id().slice(0, 8).toUpperCase()}`;
  await statement(
    c.env,
    "INSERT INTO hives (id,public_id,producer_id,apiary_id,name,species,queen_age,installation_date,status,created_at) VALUES (?,?,?,?,?,?,?,?,'Watch',?)",
    hiveId,
    publicId,
    apiary.producer_id,
    input.apiaryId,
    input.name,
    input.species,
    input.queenAge,
    input.installationDate,
    now(),
  ).run();
  await audit(c, "Hive registered", hiveId, publicId, apiary.producer_id);
  return ok(c, await getHive(c, hiveId), 201);
});
hives.get("/:id", async (c) => {
  const hive = await getHive(c, c.req.param("id"));
  const [readings, inspections, alerts] = await Promise.all([
    statement(
      c.env,
      "SELECT * FROM hive_readings WHERE hive_id=? ORDER BY timestamp DESC LIMIT 168",
      hive.id,
    ).all<Reading>(),
    statement(
      c.env,
      "SELECT * FROM hive_inspections WHERE hive_id=? ORDER BY created_at DESC LIMIT 10",
      hive.id,
    ).all(),
    statement(
      c.env,
      "SELECT * FROM hive_alerts WHERE hive_id=? AND status='OPEN' ORDER BY created_at DESC",
      hive.id,
    ).all(),
  ]);
  return ok(c, {
    hive,
    readings: readings.results.reverse(),
    inspections: inspections.results,
    alerts: alerts.results,
  });
});
hives.get("/:id/readings", async (c) => {
  const hive = await getHive(c, c.req.param("id"));
  const { results } = await statement(
    c.env,
    "SELECT * FROM hive_readings WHERE hive_id=? ORDER BY timestamp DESC LIMIT 1000",
    hive.id,
  ).all<Reading>();
  return ok(c, results.reverse());
});
hives.post("/:id/readings", roles("producer", "admin"), async (c) => {
  const hive = await getHive(c, c.req.param("id"));
  const input = await body(c, readingSchema);
  const result = await addReading(c, hive.id, hive.producer_id, input);
  await audit(
    c,
    "Hive reading recorded",
    hive.id,
    `${result.status}: ${input.temperature}°C`,
    hive.producer_id,
  );
  return ok(c, result, 201);
});
hives.post("/:id/simulate", roles("producer", "admin"), async (c) => {
  if (c.env.DEMO_MODE !== "true")
    fail(404, "The sensor simulator is disabled.");
  const hive = await getHive(c, c.req.param("id"));
  const { mode } = await body(
    c,
    z.object({ mode: z.enum(["healthy", "stress"]) }).strict(),
  );
  const input =
    mode === "stress"
      ? {
          temperature: 43.2,
          humidity: 88,
          weight: hive.weight ?? 34,
          activity: 21,
        }
      : {
          temperature: 34.1,
          humidity: 56,
          weight: hive.weight ?? 34,
          activity: 89,
        };
  const result = await addReading(c, hive.id, hive.producer_id, input);
  await audit(
    c,
    mode === "stress" ? "Hive stress simulated" : "Healthy telemetry simulated",
    hive.id,
    `${result.status}; sensor simulator`,
    hive.producer_id,
  );
  return ok(c, result);
});
hives.post("/:id/device-token", roles("producer", "admin"), async (c) => {
  const hive = await getHive(c, c.req.param("id"));
  const token = `bh_device_${id()}${id()}`;
  await statement(
    c.env,
    "UPDATE hives SET device_token_hash=? WHERE id=?",
    await digest(token),
    hive.id,
  ).run();
  await audit(
    c,
    "Device token rotated",
    hive.id,
    "Previous device token invalidated",
    hive.producer_id,
  );
  return ok(c, {
    token,
    hiveId: hive.public_id,
    endpoint: `/api/iot/hives/${hive.public_id}/readings`,
  });
});
export const iot = new Hono<AppEnv>();
iot.post("/hives/:id/readings", async (c) => {
  const token = c.req.header("Authorization")?.replace(/^Bearer /, "");
  if (!token) fail(401, "Device bearer token required.");
  const hive = await statement(
    c.env,
    "SELECT id,producer_id,device_token_hash FROM hives WHERE public_id=?",
    c.req.param("id"),
  ).first<{
    id: string;
    producer_id: string;
    device_token_hash: string | null;
  }>();
  if (
    !hive?.device_token_hash ||
    !(await constantEqual(await digest(token), hive.device_token_hash))
  )
    fail(401, "Invalid device token.");
  const result = await addReading(
    c,
    hive.id,
    hive.producer_id,
    await body(c, readingSchema),
  );
  await audit(
    c,
    "Device telemetry received",
    hive.id,
    result.status,
    hive.producer_id,
  );
  return ok(c, result, 201);
});
export default hives;
