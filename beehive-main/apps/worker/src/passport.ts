import { Hono } from "hono";
import type { AppEnv } from "./types";
import { authenticated, roles } from "./auth";
import { getBatchRow, hydrateBatch } from "./batches";
import { verifyBatch } from "./verify";
import { statement, ok, fail, id, now, audit } from "./core";
import { sha256 } from "../../../packages/shared/src/canonical";
const passport = new Hono<AppEnv>();
passport.use("*", authenticated, roles("producer", "admin"));
passport.post("/:id/passport", async (c) => {
  const batch = await getBatchRow(c, c.req.param("id"));
  const verified = await verifyBatch(c, batch.public_id);
  if (verified.verdict !== "AUTHENTIC")
    fail(409, "A currently authentic record is required to issue a passport.");
  const origin = c.req.header("Origin");
  const baseUrl =
    origin &&
    (origin === c.env.APP_URL ||
      origin.includes("sajidbanday.me") ||
      origin.includes("localhost") ||
      origin.includes("127.0.0.1"))
      ? origin
      : c.env.APP_URL;
  const url = `${baseUrl}/verify/${batch.public_id}`;
  const report = JSON.stringify(
    {
      publicId: batch.public_id,
      verificationUrl: url,
      issuedAt: now(),
      verification: verified,
    },
    null,
    2,
  );
  const digest = await sha256(report),
    docId = id(),
    key = `reports/${batch.producer_id}/${docId}.json`;
  await c.env.BUCKET.put(key, report, {
    httpMetadata: { contentType: "application/json" },
  });
  await statement(
    c.env,
    "INSERT INTO batch_documents (id,batch_id,producer_id,object_key,filename,content_type,size,digest,kind,created_at) VALUES (?,?,?,?,?,'application/json',?,?,'report',?)",
    docId,
    batch.id,
    batch.producer_id,
    key,
    `${batch.public_id}-report.json`,
    new TextEncoder().encode(report).length,
    digest,
    now(),
  ).run();
  await audit(c, "Batch QR generated", batch.id, url, batch.producer_id);
  return ok(c, { verificationUrl: url, reportId: docId });
});
export default passport;
