import { Hono, type Context, type MiddlewareHandler } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { z } from "zod";
import type { AppEnv } from "./types";
import type { User, Role } from "../../../packages/shared/src/index";
import { body, statement, ok, fail, now, id, audit } from "./core";
const enc = new TextEncoder();
export async function digest(value: string) {
  return Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(value))),
    (v) => v.toString(16).padStart(2, "0"),
  ).join("");
}
export async function passwordHash(
  password: string,
  salt: string = crypto.randomUUID(),
) {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bytes = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: enc.encode(salt),
      iterations: 100000,
      hash: "SHA-256",
    },
    key,
    256,
  );
  return `pbkdf2:100000:${salt}:${Array.from(new Uint8Array(bytes), (v) => v.toString(16).padStart(2, "0")).join("")}`;
}
export async function constantEqual(a: string, b: string) {
  const key = await crypto.subtle.generateKey(
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(a));
  return crypto.subtle.verify("HMAC", key, sig, enc.encode(b));
}
export const authenticated: MiddlewareHandler<AppEnv> = async (c, next) => {
  const token = getCookie(c, "bh_session");
  if (!token) fail(401, "Sign in to continue.");
  const row = await statement(
    c.env,
    "SELECT u.id,u.name,u.email,u.role,u.producer_id FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?",
    await digest(token),
    now(),
  ).first<{
    id: string;
    name: string;
    email: string;
    role: Role;
    producer_id: string | null;
  }>();
  if (!row) fail(401, "Your session has expired. Sign in again.");
  c.set("user", {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    producerId: row.producer_id,
  });
  await next();
};
export const roles =
  (...allowed: Role[]): MiddlewareHandler<AppEnv> =>
  async (c, next) => {
    if (!allowed.includes(c.get("user").role))
      fail(403, "Your role does not have access to this action.");
    await next();
  };
async function session(c: Context<AppEnv>, user: User) {
  const token = `${id()}${id()}`;
  await statement(
    c.env,
    "INSERT INTO sessions (token_hash,user_id,expires_at) VALUES (?,?,?)",
    await digest(token),
    user.id,
    new Date(Date.now() + 8 * 3600000).toISOString(),
  ).run();
  const isHttps =
    c.env.APP_URL.startsWith("https:") ||
    c.req.header("x-forwarded-proto") === "https" ||
    c.req.header("origin")?.startsWith("https:") === true;
  setCookie(c, "bh_session", token, {
    httpOnly: true,
    secure: isHttps,
    sameSite: "Lax",
    path: "/",
    maxAge: 8 * 3600,
  });
  c.set("user", user);
  await audit(c, "Signed in", user.id, "Session created");
  return ok(c, user);
}
const auth = new Hono<AppEnv>();
auth.post("/login", async (c) => {
  const { email, password } = await body(
    c,
    z
      .object({
        email: z.email().max(254),
        password: z.string().min(1).max(200),
      })
      .strict(),
  );
  const row = await statement(
    c.env,
    "SELECT * FROM users WHERE email=?",
    email.toLowerCase(),
  ).first<{
    id: string;
    email: string;
    name: string;
    role: Role;
    producer_id: string | null;
    password_hash: string | null;
  }>();
  const salt = row?.password_hash?.split(":")[2] ?? "invalid-user-salt";
  const calculated = await passwordHash(password, salt);
  if (
    !row?.password_hash ||
    !(await constantEqual(calculated, row.password_hash))
  )
    fail(401, "Email or password is incorrect.");
  return session(c, {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    producerId: row.producer_id,
  });
});
auth.post("/demo", async (c) => {
  if (c.env.DEMO_MODE !== "true") fail(404, "Demo access is disabled.");
  const { role } = await body(
    c,
    z.object({ role: z.enum(["producer", "authority", "admin"]) }).strict(),
  );
  const row = await statement(
    c.env,
    "SELECT id,name,email,role,producer_id FROM users WHERE id=?",
    `demo-${role}`,
  ).first<{
    id: string;
    name: string;
    email: string;
    role: Role;
    producer_id: string | null;
  }>();
  if (!row) fail(503, "Demo data is not seeded. Run npm run setup:demo.");
  return session(c, {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    producerId: row.producer_id,
  });
});
auth.get("/me", authenticated, (c) => ok(c, c.get("user")));
auth.post("/logout", authenticated, async (c) => {
  const token = getCookie(c, "bh_session")!;
  await statement(
    c.env,
    "DELETE FROM sessions WHERE token_hash=?",
    await digest(token),
  ).run();
  deleteCookie(c, "bh_session", { path: "/" });
  return ok(c, { loggedOut: true });
});
export default auth;
