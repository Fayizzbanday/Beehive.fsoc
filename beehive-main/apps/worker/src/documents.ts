import { Hono } from "hono";
import type { AppEnv } from "./types";
import { authenticated, roles } from "./auth";
import { statement, ok, fail, id, now, audit, producerFilter } from "./core";
const documents = new Hono<AppEnv>();
documents.use("*", authenticated);
documents.post("/", roles("producer", "admin"), async (c) => {
  const form = await c.req
    .formData()
    .catch(() => fail(422, "Upload files using a valid multipart form."));
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0 || file.size > 5 * 1024 * 1024)
    fail(422, "Upload a non-empty PDF, PNG or JPEG up to 5 MB.");
  const contentTypes = ["application/pdf", "image/png", "image/jpeg"];
  if (!contentTypes.includes(file.type))
    fail(422, "Only PDF, PNG and JPEG files are supported.");
  const bytes = await file.arrayBuffer();
  const prefix = new Uint8Array(bytes.slice(0, 8));
  const valid =
    file.type === "application/pdf"
      ? new TextDecoder().decode(prefix).startsWith("%PDF-")
      : file.type === "image/png"
        ? prefix[0] === 137 &&
          prefix[1] === 80 &&
          prefix[2] === 78 &&
          prefix[3] === 71
        : prefix[0] === 255 && prefix[1] === 216 && prefix[2] === 255;
  if (!valid) fail(422, "File contents do not match the declared type.");
  const user = c.get("user");
  const f = producerFilter(c);
  const apiary = await statement(
    c.env,
    `SELECT producer_id FROM apiaries WHERE id=? AND ${f.sql}`,
    String(form.get("apiaryId") ?? ""),
    ...f.values,
  ).first<{ producer_id: string }>();
  if (!apiary) fail(422, "Choose the apiary this document belongs to.");
  const docId = id(),
    objectKey = `evidence/${apiary.producer_id}/${docId}`;
  const digest =
    "0x" +
    Array.from(
      new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
      (b) => b.toString(16).padStart(2, "0"),
    ).join("");
  const filename = file.name.replace(/[^a-zA-Z0-9._ -]/g, "_").slice(0, 120);
  await c.env.BUCKET.put(objectKey, bytes, {
    httpMetadata: { contentType: file.type },
    customMetadata: { digest },
  });
  try {
    await statement(
      c.env,
      "INSERT INTO batch_documents (id,producer_id,object_key,filename,content_type,size,digest,created_at) VALUES (?,?,?,?,?,?,?,?)",
      docId,
      apiary.producer_id,
      objectKey,
      filename,
      file.type,
      file.size,
      digest,
      now(),
    ).run();
  } catch (error) {
    await c.env.BUCKET.delete(objectKey);
    throw error;
  }
  await audit(
    c,
    "Evidence uploaded",
    docId,
    `${filename}; ${digest}`,
    apiary.producer_id,
  );
  return ok(c, { id: docId, filename, digest, size: file.size }, 201);
});
documents.get("/:id", async (c) => {
  const f = producerFilter(c);
  const doc = await statement(
    c.env,
    `SELECT * FROM batch_documents WHERE id=? AND ${f.sql}`,
    c.req.param("id"),
    ...f.values,
  ).first<{ object_key: string; filename: string; content_type: string }>();
  if (!doc) fail(404, "Document not found.");
  const object = await c.env.BUCKET.get(doc.object_key);
  if (!object) fail(404, "Document object is missing.");
  return new Response(object.body, {
    headers: {
      "Content-Type": doc.content_type,
      "Content-Disposition": `attachment; filename="${doc.filename.replaceAll('"', "_")}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
export default documents;
