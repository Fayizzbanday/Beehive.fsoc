import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { bodyLimit } from "hono/body-limit";
import { HTTPException } from "hono/http-exception";
import type { AppEnv } from "./types";
import { hiveHealth } from "../../../packages/shared/src/index";
import { id, ok, fail, statement } from "./core";
import passport from "./passport";
import proofs from "./proofs";
import verify from "./verify";
import demo from "./demo";
import authority from "./authority";
import analysis from "./analysis";
import batches from "./batches";
import documents from "./documents";
import auth, { authenticated } from "./auth";
import hives, { iot } from "./hives";
import scans from "./scans";
import { producerFilter } from "./core";

export function isAllowedOrigin(origin: string | undefined | null, configuredAppUrl: string) {
  if (!origin) return true;
  if (origin === configuredAppUrl) return true;
  try {
    const { hostname } = new URL(origin);
    if (hostname === "localhost" || hostname === "127.0.0.1") return true;
    if (hostname === "test.sajidbanday.me" || hostname.endsWith(".sajidbanday.me")) return true;
    if (hostname === "bee-hive-demo.pages.dev" || hostname.endsWith(".pages.dev")) return true;
  } catch {}
  return false;
}

const app = new Hono<AppEnv>();
app.use("*", async (c, next) => {
  c.set("requestId", id());
  c.header("X-Request-Id", c.get("requestId"));
  c.header("Cache-Control", "no-store");
  await next();
});
app.use("*", secureHeaders());
app.use("/api/*", async (c, next) => {
  const origin = c.req.header("Origin");
  if (origin && !isAllowedOrigin(origin, c.env.APP_URL))
    fail(403, "This origin is not allowed.");
  return cors({
    origin: (reqOrigin) =>
      isAllowedOrigin(reqOrigin, c.env.APP_URL)
        ? reqOrigin || c.env.APP_URL
        : c.env.APP_URL,
    credentials: true,
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  })(c, next);
});
app.use(
  "/api/*",
  bodyLimit({
    maxSize: 5 * 1024 * 1024 + 16384,
    onError: (c) =>
      c.json(
        {
          success: false,
          error: {
            code: "PAYLOAD_TOO_LARGE",
            message: "Files must be 5 MB or smaller.",
          },
          requestId: c.get("requestId"),
        },
        413,
      ),
  }),
);
app.use("/api/*", async (c, next) => {
  if (c.req.method === "OPTIONS") return next();
  const bucket = Math.floor(Date.now() / 60000);
  const ip = c.req.header("CF-Connecting-IP") ?? "local";
  const group = c.req.path.includes("/auth/") ? "auth" : "api";
  const key = `${group}:${ip}:${bucket}`;
  const row = await statement(
    c.env,
    "INSERT INTO rate_limits (key,hits,reset_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET hits=hits+1 RETURNING hits",
    key,
    (bucket + 1) * 60000,
  ).first<{ hits: number }>();
  if (row && row.hits > (group === "auth" ? 30 : 240)) {
    c.header("Retry-After", "60");
    fail(429, "Too many requests. Try again in one minute.");
  }
  await next();
});
app.get("/api/public/preview", async (c) => {
  if (c.env.DEMO_MODE !== "true") return ok(c, []);
  const { results } = await statement(
    c.env,
    `SELECT h.id,h.public_id,h.name,h.status,r.temperature,r.humidity,r.weight,r.timestamp FROM hives h LEFT JOIN hive_readings r ON r.id=(SELECT id FROM hive_readings WHERE hive_id=h.id ORDER BY timestamp DESC LIMIT 1) WHERE h.id IN ('hive-001','hive-002','hive-003','hive-004') ORDER BY h.id`,
  ).all<{ temperature: number | null; humidity: number | null }>();
  return ok(
    c,
    results.map((h) => ({
      ...h,
      healthScore: hiveHealth(h.temperature, h.humidity),
    })),
  );
});
app.get("/api/health", (c) =>
  ok(c, {
    status: "healthy",
    demoMode: c.env.DEMO_MODE === "true",
    network: c.env.NETWORK_NAME,
    contractConfigured: !!c.env.CONTRACT_ADDRESS,
  }),
);
app.route("/api/auth", auth);
app.route("/api/batches", batches);
app.route("/api/batches", analysis);
app.route("/api/batches", proofs);
app.route("/api/batches", passport);
app.route("/api/verify", verify);
app.route("/api/demo", demo);
app.route("/api/authority", authority);
app.route("/api/documents", documents);
app.route("/api/hives", hives);
app.route("/api/scans", scans);
app.route("/api/iot", iot);
app.get("/api/apiaries", authenticated, async (c) => {
  const f = producerFilter(c);
  return ok(
    c,
    (
      await statement(
        c.env,
        `SELECT * FROM apiaries WHERE ${f.sql} ORDER BY name`,
        ...f.values,
      ).all()
    ).results,
  );
});
app.get("/api/dashboard/metrics", authenticated, async (c) => {
  const f = producerFilter(c);
  const alerts = await statement(
    c.env,
    `SELECT COUNT(*) as count FROM hive_alerts WHERE status='OPEN' AND ${f.sql}`,
    ...f.values,
  ).first<{ count: number }>();
  return ok(c, { activeAlerts: alerts?.count ?? 0 });
});
app.get("/api/activity", authenticated, async (c) => {
  const f = producerFilter(c);
  return ok(
    c,
    (
      await statement(
        c.env,
        `SELECT action,detail,created_at,entity_id FROM audit_logs WHERE ${f.sql} ORDER BY created_at DESC LIMIT 30`,
        ...f.values,
      ).all()
    ).results,
  );
});
app.onError((error, c) => {
  const status = error instanceof HTTPException ? error.status : 500;
  if (status === 500)
    console.error(
      JSON.stringify({ requestId: c.get("requestId"), message: error.message }),
    );
  return c.json(
    {
      success: false,
      error: {
        code: `HTTP_${status}`,
        message:
          status === 500
            ? "The request could not be completed. Please retry."
            : error.message,
      },
      requestId: c.get("requestId"),
    },
    status,
  );
});
app.notFound((c) =>
  c.json(
    {
      success: false,
      error: { code: "NOT_FOUND", message: "API route not found." },
      requestId: c.get("requestId"),
    },
    404,
  ),
);
export default app;
