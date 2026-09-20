import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import type { z } from "zod";
import type { AppEnv, Bindings } from "./types";
export const now = () => new Date().toISOString();
export const id = () => crypto.randomUUID();
export const ok = <T>(
  c: Context<AppEnv>,
  data: T,
  status: 200 | 201 | 202 = 200,
) =>
  c.json(
    { success: true as const, data, requestId: c.get("requestId") },
    status,
  );
export function fail(
  status: 400 | 401 | 403 | 404 | 409 | 422 | 429 | 503,
  message: string,
): never {
  throw new HTTPException(status, { message });
}
export async function body<T>(
  c: Context<AppEnv>,
  schema: z.ZodType<T>,
): Promise<T> {
  let value: unknown;
  try {
    value = await c.req.json();
  } catch {
    fail(400, "Send valid JSON in the request body.");
  }
  const parsed = schema.safeParse(value);
  if (!parsed.success)
    fail(
      422,
      parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; "),
    );
  return parsed.data;
}
export function statement(
  env: Bindings,
  sql: string,
  ...values: (string | number | null)[]
) {
  return env.DB.prepare(sql).bind(...values);
}
export async function audit(
  c: Context<AppEnv>,
  action: string,
  entityId: string,
  detail: string,
  producerId?: string | null,
) {
  const u = c.get("user");
  await statement(
    c.env,
    "INSERT INTO audit_logs (id,user_id,producer_id,action,entity_id,detail,created_at) VALUES (?,?,?,?,?,?,?)",
    id(),
    u?.id ?? null,
    producerId ?? u?.producerId ?? null,
    action,
    entityId,
    detail,
    now(),
  ).run();
}
export function producerFilter(
  c: Context<AppEnv>,
  column = "producer_id",
): { sql: string; values: string[] } {
  const user = c.get("user");
  return user.role === "producer"
    ? { sql: `${column} = ?`, values: [user.producerId!] }
    : { sql: "1 = 1", values: [] };
}
