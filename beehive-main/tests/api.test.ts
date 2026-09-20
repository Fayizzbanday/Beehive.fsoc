import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { buildSync } from "esbuild";
import { readFileSync, readdirSync, openSync, mkdirSync } from "node:fs";
import { spawn, type ChildProcess } from "node:child_process";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  type Hex,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { registryAbi } from "../packages/blockchain/src/abi";
import { goldenRecord } from "./fixtures";
import {
  hashRecord,
  canonicalJson,
  sha256,
} from "../packages/shared/src/canonical";
import { assessRisk } from "../packages/risk-engine/src/index";
import type {
  Batch,
  ReputationForecast,
  Scan,
  Verification,
} from "../packages/shared/src/index";
let mf: Miniflare,
  chainProcess: ChildProcess,
  producerCookie = "",
  adminCookie = "",
  authorityCookie = "";
let publicClient: ReturnType<typeof createPublicClient>,
  contract: Hex,
  key: Hex;
const rpc = "http://127.0.0.1:18545";
const chain = defineChain({
  id: 31337,
  name: "Test EVM",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [rpc] } },
});
async function request<T = Record<string, unknown>>(
  path: string,
  options: {
    body?: unknown;
    cookie?: string;
    method?: string;
    headers?: Record<string, string>;
  } = {},
) {
  const r = await mf.dispatchFetch(`http://localhost/api${path}`, {
    method: options.method ?? (options.body ? "POST" : "GET"),
    headers: {
      "Content-Type": "application/json",
      ...(options.cookie ? { Cookie: options.cookie } : {}),
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const json = (await r.json()) as {
    success: boolean;
    data: T;
    error: { message: string };
  };
  return { status: r.status, headers: r.headers, ...json };
}
beforeAll(async () => {
  mkdirSync(".local", { recursive: true });
  const log = openSync(".local/test-chain.log", "w");
  chainProcess = spawn(
    process.execPath,
    [
      "node_modules/hardhat/dist/src/cli.js",
      "node",
      "--hostname",
      "127.0.0.1",
      "--port",
      "18545",
    ],
    { stdio: ["ignore", log, log] },
  );
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "eth_chainId",
          params: [],
        }),
      });
      if (((await r.json()) as { result?: string }).result === "0x7a69") break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  key = generatePrivateKey();
  const account = privateKeyToAccount(key);
  await fetch(rpc, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "hardhat_setBalance",
      params: [account.address, "0x56BC75E2D63100000"],
    }),
  });
  const wallet = createWalletClient({ account, chain, transport: http(rpc) });
  publicClient = createPublicClient({ chain, transport: http(rpc) });
  const artifact = JSON.parse(
    readFileSync("artifacts/BeeHiveRegistry.json", "utf8"),
  );
  const tx = await wallet.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
  contract = receipt.contractAddress!;
  const script = buildSync({
    entryPoints: ["apps/worker/src/index.ts"],
    bundle: true,
    write: false,
    format: "esm",
    platform: "browser",
    target: "es2022",
    conditions: ["workerd", "worker", "browser"],
    external: ["node:*", "cloudflare:*"],
  }).outputFiles[0].text;
  mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script,
      compatibilityDate: "2026-09-06",
      compatibilityFlags: ["nodejs_compat"],
      d1Databases: ["DB"],
      r2Buckets: ["BUCKET"],
      bindings: {
        APP_URL: "http://localhost:5174",
        DEMO_MODE: "true",
        EVM_RPC_URL: rpc,
        CHAIN_ID: "31337",
        CONTRACT_ADDRESS: contract,
        NETWORK_NAME: "Test EVM",
        BLOCK_EXPLORER_URL: "",
        BLOCKCHAIN_PRIVATE_KEY: key,
      },
    }),
  );
  const db = await mf.getD1Database("DB");
  for (const file of readdirSync("migrations").sort())
    await db.exec(readFileSync(`migrations/${file}`, "utf8"));
  const r = { ...goldenRecord };
  const assessment = assessRisk(r, {
    now: "2026-09-06T09:00:00.000Z",
    hiveTemperature: 34,
    hiveHumidity: 55,
  });
  r.aiAssessmentDigest = await sha256(canonicalJson(assessment));
  await db.batch([
    db
      .prepare("INSERT INTO producers VALUES (?,?,?,?)")
      .bind(
        "producer-mountain",
        "Mountain Gold Apiary",
        "Jammu & Kashmir",
        r.createdAt,
      ),
    db
      .prepare("INSERT INTO producers VALUES (?,?,?,?)")
      .bind("producer-other", "Other Apiary", "Punjab", r.createdAt),
    ...["producer", "admin", "authority"].map((role) =>
      db
        .prepare(
          "INSERT INTO users (id,email,name,role,producer_id,created_at) VALUES (?,?,?,?,?,?)",
        )
        .bind(
          `demo-${role}`,
          `${role}@demo.test`,
          role,
          role,
          role === "authority" ? null : r.producerId,
          r.createdAt,
        ),
    ),
    db
      .prepare("INSERT INTO apiaries VALUES (?,?,?,?,?,?)")
      .bind(
        "apiary-lidder",
        r.producerId,
        r.apiary,
        r.origin.region,
        r.origin.latitude,
        r.origin.longitude,
      ),
    db
      .prepare("INSERT INTO apiaries VALUES (?,?,?,?,?,?)")
      .bind("apiary-other", "producer-other", "Other", "Punjab", 30, 75),
    db
      .prepare(
        "INSERT INTO hives (id,public_id,producer_id,apiary_id,name,species,queen_age,installation_date,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
      )
      .bind(
        "hive-042",
        "HIVE-0042",
        r.producerId,
        "apiary-lidder",
        "Acacia ridge",
        "Apis mellifera",
        6,
        "2026-03-10",
        "Healthy",
        r.createdAt,
      ),
    db
      .prepare(
        "INSERT INTO hives (id,public_id,producer_id,apiary_id,name,species,queen_age,installation_date,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
      )
      .bind(
        "hive-other",
        "HIVE-OTHER",
        "producer-other",
        "apiary-other",
        "Other hive",
        "Apis mellifera",
        6,
        "2026-03-10",
        "Healthy",
        r.createdAt,
      ),
    db
      .prepare(
        "INSERT INTO batches (id,public_id,producer_id,apiary_id,record_json,lot_information,extraction_method,status,is_demo,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
      )
      .bind(
        "batch-42",
        r.publicId,
        r.producerId,
        "apiary-lidder",
        JSON.stringify(r),
        r.lotInformation,
        r.extractionMethod,
        "ANALYZED",
        1,
        r.createdAt,
      ),
    db
      .prepare("INSERT INTO batch_hives VALUES (?,?)")
      .bind("batch-42", "hive-042"),
    db
      .prepare("INSERT INTO ai_assessments VALUES (?,?,?,?,?,?,?)")
      .bind(
        "assessment-42",
        "batch-42",
        assessment.score,
        assessment.classification,
        JSON.stringify(assessment),
        r.aiAssessmentDigest,
        assessment.timestamp,
      ),
  ]);
  for (const role of ["producer", "admin", "authority"]) {
    const response = await request("/auth/demo", { body: { role } });
    expect(response.status).toBe(200);
    const cookie = response.headers.get("set-cookie")!.split(";")[0];
    if (role === "producer") producerCookie = cookie;
    if (role === "admin") adminCookie = cookie;
    if (role === "authority") authorityCookie = cookie;
  }
}, 60000);
afterAll(async () => {
  await mf?.dispose();
  chainProcess?.kill("SIGTERM");
});
describe("Worker security and validation", () => {
  it("requires authentication for producer and authority records", async () => {
    expect((await request("/hives")).status).toBe(401);
    expect((await request("/authority/records")).status).toBe(401);
  });
  it("rejects the wrong role and cross-producer access", async () => {
    expect(
      (await request("/authority/overview", { cookie: producerCookie })).status,
    ).toBe(403);
    expect(
      (await request("/hives/HIVE-OTHER", { cookie: producerCookie })).status,
    ).toBe(404);
    expect(
      (
        await request("/hives/HIVE-0042/simulate", {
          cookie: authorityCookie,
          body: { mode: "stress" },
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await request("/demo/tamper/BH-2026-000042", {
          cookie: producerCookie,
          body: {},
        })
      ).status,
    ).toBe(403);
  });
  it("validates JSON, values and strict CORS", async () => {
    expect(
      (
        await request("/hives/HIVE-0042/readings", {
          cookie: producerCookie,
          body: { temperature: 100, humidity: 55, weight: 30 },
        })
      ).status,
    ).toBe(422);
    expect(
      (
        await request("/hives", {
          cookie: producerCookie,
          headers: { Origin: "https://attacker.invalid" },
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await request("/batches", {
          cookie: producerCookie,
          body: { quantity: -10 },
        })
      ).status,
    ).toBe(422);
  });
  it("uses HttpOnly SameSite cookies and clears them at logout", async () => {
    const login = await request("/auth/demo", { body: { role: "producer" } });
    expect(login.headers.get("set-cookie")).toContain("HttpOnly");
    expect(login.headers.get("set-cookie")).toContain("SameSite=Lax");
    const cookie = login.headers.get("set-cookie")!.split(";")[0];
    expect((await request("/auth/logout", { cookie, body: {} })).status).toBe(
      200,
    );
    expect((await request("/auth/me", { cookie })).status).toBe(401);
  });
  it("checks uploaded bytes, stores evidence in R2 and protects downloads", async () => {
    const upload = async (
      contents: string,
      cookie: string,
      apiaryId = "apiary-lidder",
    ) => {
      const form = new FormData();
      form.append("apiaryId", apiaryId);
      form.append(
        "file",
        new File([contents], "harvest-certificate.pdf", {
          type: "application/pdf",
        }),
      );
      const encoded = new Request("http://localhost/api/documents", {
        method: "POST",
        headers: { Cookie: cookie },
        body: form,
      });
      return mf.dispatchFetch(encoded.url, {
        method: "POST",
        headers: Object.fromEntries(encoded.headers),
        body: await encoded.arrayBuffer(),
      });
    };
    expect(
      (await upload("<script>invalid</script>", producerCookie)).status,
    ).toBe(422);
    const bytes = "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF";
    expect((await upload(bytes, authorityCookie)).status).toBe(403);
    expect((await upload(bytes, producerCookie, "apiary-other")).status).toBe(
      422,
    );
    const saved = await upload(bytes, producerCookie);
    expect(saved.status).toBe(201);
    const { data } = (await saved.json()) as {
      data: { id: string; digest: string };
    };
    expect(data.digest).toBe(await sha256(bytes));
    expect((await request(`/documents/${data.id}`)).status).toBe(401);
    const file = await mf.dispatchFetch(
      `http://localhost/api/documents/${data.id}`,
      { headers: { Cookie: producerCookie } },
    );
    expect(file.headers.get("content-type")).toBe("application/pdf");
    expect(await file.text()).toBe(bytes);
  });
  it("runs an AI vision scan, stores keyframes and keeps the report off the certified record", async () => {
    const bytes = (values: number[]) => new Uint8Array(values).buffer;
    const jpeg = bytes([255, 216, 255, 224, 0, 16, 74, 70, 73, 70, 0]);
    const scan = async (
      cookie: string,
      metadata: Record<string, unknown>,
      frameBytes: ArrayBuffer = jpeg,
    ) => {
      const form = new FormData();
      form.append("metadata", JSON.stringify(metadata));
      form.append(
        "frame",
        new File([frameBytes], "frame-0.jpg", { type: "image/jpeg" }),
      );
      const encoded = new Request("http://localhost/api/scans", {
        method: "POST",
        headers: { Cookie: cookie },
        body: form,
      });
      const response = await mf.dispatchFetch(encoded.url, {
        method: "POST",
        headers: Object.fromEntries(encoded.headers),
        body: await encoded.arrayBuffer(),
      });
      return {
        status: response.status,
        json: (await response.json()) as {
          data: Scan;
          error: { message: string };
        },
      };
    };
    const metadata = {
      mode: "DIGITAL_TWIN",
      apiaryId: "apiary-lidder",
      hiveId: "HIVE-0042",
      source: "camera",
      captureDigest: `0x${"3d".repeat(32)}`,
      durationSeconds: 11.2,
      frameCount: 1,
      notes: "",
    };
    expect((await scan(authorityCookie, metadata)).status).toBe(403);
    expect(
      (await scan(producerCookie, { ...metadata, hiveId: "HIVE-OTHER" }))
        .status,
    ).toBe(404);
    expect(
      (
        await scan(producerCookie, {
          ...metadata,
          mode: "DIGITAL_TWIN",
          hiveId: null,
        })
      ).status,
    ).toBe(422);
    expect(
      (await scan(producerCookie, metadata, bytes([1, 2, 3, 4]))).status,
    ).toBe(422);
    const created = await scan(producerCookie, metadata);
    expect(created.status).toBe(201);
    const stored = created.json.data;
    expect(stored.report.twin?.sensorWeight).toBe(null);
    expect(stored.report.simulated).toBe(true);
    expect(stored.classification).toBe(
      stored.score <= 30 ? "LOW" : stored.score <= 70 ? "MEDIUM" : "HIGH",
    );
    const repeated = await scan(producerCookie, metadata);
    expect(repeated.json.data.score).toBe(stored.score);
    const frame = await mf.dispatchFetch(
      `http://localhost/api/scans/${stored.publicId}/frames/0`,
      { headers: { Cookie: producerCookie } },
    );
    expect(frame.headers.get("content-type")).toBe("image/jpeg");
    expect(
      (
        await request(`/scans/${stored.publicId}/frames/4`, {
          cookie: producerCookie,
        })
      ).status,
    ).toBe(404);
    const list = await request<Scan[]>("/scans?mode=DIGITAL_TWIN", {
      cookie: producerCookie,
    });
    expect(list.data.some((s) => s.publicId === stored.publicId)).toBe(true);
    const batch = await request<Batch>("/batches/BH-2026-000042", {
      cookie: producerCookie,
    });
    expect(JSON.stringify(batch.data.record)).not.toContain("vision-sim");
    const forecast = await request<ReputationForecast>("/scans/forecast", {
      cookie: producerCookie,
    });
    expect(forecast.status).toBe(200);
    expect(forecast.data.version).toBe("beehive.market-signal.v1");
    expect(forecast.data.signals.length).toBeGreaterThan(0);
  });
  it("enforces per-client rate limits with retry guidance", async () => {
    const db = await mf.getD1Database("DB");
    const minute = Math.floor(Date.now() / 60000);
    await db
      .prepare("INSERT INTO rate_limits VALUES (?,?,?)")
      .bind(`api:192.0.2.44:${minute}`, 240, (minute + 1) * 60000)
      .run();
    const blocked = await request("/health", {
      headers: { "CF-Connecting-IP": "192.0.2.44" },
    });
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toBe("60");
  });
  it("keeps public verification account-free and unanchored records pending", async () => {
    const r = await request<Verification>("/verify/BH-2026-000042");
    expect(r.status).toBe(200);
    expect(r.data.verdict).toBe("PENDING");
    expect(
      (await request<Verification>("/verify/BH-2026-999999")).data.verdict,
    ).toBe("NOT_FOUND");
  });
  it("persists simulated hive stress and alerts", async () => {
    const r = await request("/hives/HIVE-0042/simulate", {
      cookie: producerCookie,
      body: { mode: "stress" },
    });
    expect(r.status).toBe(200);
    expect(r.data.status).toBe("Alert");
    const alerts = await request<{ type: string }[]>("/authority/alerts", {
      cookie: authorityCookie,
    });
    expect(alerts.data.some((a) => a.type === "HIVE_STRESS")).toBe(true);
  });
  it("authenticates ESP32 readings with a rotated per-hive token", async () => {
    expect(
      (
        await request("/iot/hives/HIVE-0042/readings", {
          body: { temperature: 34, humidity: 55, weight: 38 },
        })
      ).status,
    ).toBe(401);
    const token = await request<{ token: string }>(
      "/hives/HIVE-0042/device-token",
      { cookie: producerCookie, body: {} },
    );
    expect(
      (
        await request("/iot/hives/HIVE-0042/readings", {
          body: { temperature: 34, humidity: 55, weight: 38 },
          headers: { Authorization: `Bearer ${token.data.token}` },
        })
      ).status,
    ).toBe(201);
    await request("/hives/HIVE-0042/device-token", {
      cookie: producerCookie,
      body: {},
    });
    expect(
      (
        await request("/iot/hives/HIVE-0042/readings", {
          body: { temperature: 34, humidity: 55, weight: 38 },
          headers: { Authorization: `Bearer ${token.data.token}` },
        })
      ).status,
    ).toBe(401);
  });
  it("rejects a source hive outside the selected apiary", async () => {
    const r = await request("/batches", {
      cookie: producerCookie,
      body: {
        apiaryId: "apiary-lidder",
        hiveIds: ["hive-other"],
        harvestDate: "2026-09-05",
        honeyType: "Acacia",
        quantity: 25,
        moisture: 18,
        lotInformation: "INVALID-LOT",
        extractionMethod: "Cold extraction",
        notes: "",
      },
    });
    expect(r.status).toBe(422);
  });
});
describe("real Solidity certification and tamper recovery", () => {
  it("anchors through the Worker and verifies against the EVM contract", async () => {
    const submitted = await request<Batch>("/batches/BH-2026-000042/anchor", {
      cookie: producerCookie,
      body: {},
    });
    expect(submitted.status).toBe(202);
    expect(submitted.data.proof?.blockchain_tx_hash).toMatch(
      /^0x[a-f0-9]{64}$/,
    );
    const confirmed = await request<Batch>(
      "/batches/BH-2026-000042/anchor/confirm",
      { cookie: producerCookie, body: {} },
    );
    expect(confirmed.data.status).toBe("ANCHORED");
    expect(
      await publicClient.readContract({
        address: contract,
        abi: registryAbi,
        functionName: "verifyRecord",
        args: [confirmed.data.proof!.record_hash as Hex],
      }),
    ).toBe(true);
    const verified = await request<Verification>("/verify/BH-2026-000042");
    expect(verified.data.verdict).toBe("AUTHENTIC");
    expect(verified.data.currentHash).toBe(verified.data.anchoredHash);
  });
  it("issues an R2 report and a URL-only passport", async () => {
    const response = await request<{
      verificationUrl: string;
      reportId: string;
    }>("/batches/BH-2026-000042/passport", {
      cookie: producerCookie,
      body: {},
    });
    expect(response.status).toBe(200);
    expect(response.data.verificationUrl).toBe(
      "http://localhost:5174/verify/BH-2026-000042",
    );
    const r = await mf.dispatchFetch(
      `http://localhost/api/documents/${response.data.reportId}`,
      { headers: { Cookie: producerCookie } },
    );
    expect(r.status).toBe(200);
    expect(r.headers.get("content-disposition")).toContain("attachment");
    const report = (await r.json()) as { verification: Verification };
    expect(report.verification.verdict).toBe("AUTHENTIC");
    const listed = await request<{ id: string }[]>(
      "/batches/BH-2026-000042/documents",
      { cookie: authorityCookie },
    );
    expect(listed.data.some((doc) => doc.id === response.data.reportId)).toBe(
      true,
    );
  });
  it("exposes tampering, preserves the chain hash and alerts the authority", async () => {
    const original = await request<Verification>("/verify/BH-2026-000042");
    const tampered = await request<Verification>(
      "/demo/tamper/BH-2026-000042",
      { cookie: adminCookie, body: {} },
    );
    expect(tampered.data.verdict).toBe("TAMPERED");
    expect(tampered.data.record!.quantity).toBe(250);
    expect(tampered.data.currentHash).not.toBe(original.data.currentHash);
    expect(tampered.data.anchoredHash).toBe(original.data.anchoredHash);
    expect(
      (await request<Verification>("/verify/BH-2026-000042")).data.verdict,
    ).toBe("TAMPERED");
    const alerts = await request<{ type: string; status: string }[]>(
      "/authority/alerts",
      { cookie: authorityCookie },
    );
    expect(
      alerts.data.filter((a) => a.type === "TAMPER" && a.status === "OPEN"),
    ).toHaveLength(1);
  });
  it("restores the certified snapshot without deleting audit history", async () => {
    const restored = await request<Verification>("/demo/reset/BH-2026-000042", {
      cookie: adminCookie,
      body: {},
    });
    expect(restored.data.verdict).toBe("AUTHENTIC");
    expect(restored.data.record!.quantity).toBe(25);
    const db = await mf.getD1Database("DB");
    expect(
      (await db
        .prepare(
          "SELECT COUNT(*) as count FROM audit_logs WHERE action='Database tampering simulated'",
        )
        .first<{ count: number }>())!.count,
    ).toBe(1);
    expect(
      (
        await request<{ type: string; status: string }[]>("/authority/alerts", {
          cookie: authorityCookie,
        })
      ).data.some((a) => a.type === "TAMPER" && a.status === "RESOLVED"),
    ).toBe(true);
  });
  it("detects modified assessment evidence as well as certified fields", async () => {
    const db = await mf.getD1Database("DB");
    const row = await db
      .prepare(
        "SELECT assessment_json FROM ai_assessments WHERE id='assessment-42'",
      )
      .first<{ assessment_json: string }>();
    const changed = JSON.parse(row!.assessment_json);
    changed.score = 0;
    await db
      .prepare(
        "UPDATE ai_assessments SET assessment_json=? WHERE id='assessment-42'",
      )
      .bind(JSON.stringify(changed))
      .run();
    expect(
      (await request<Verification>("/verify/BH-2026-000042")).data.verdict,
    ).toBe("TAMPERED");
    await db
      .prepare(
        "UPDATE ai_assessments SET assessment_json=? WHERE id='assessment-42'",
      )
      .bind(row!.assessment_json)
      .run();
  });
  it("detects removal of the committed assessment", async () => {
    const db = await mf.getD1Database("DB");
    const saved = await db
      .prepare("SELECT * FROM ai_assessments WHERE id='assessment-42'")
      .first<Record<string, string | number>>();
    await db
      .prepare("DELETE FROM ai_assessments WHERE id='assessment-42'")
      .run();
    try {
      expect(
        (await request<Verification>("/verify/BH-2026-000042")).data.verdict,
      ).toBe("TAMPERED");
    } finally {
      await db
        .prepare(
          "INSERT INTO ai_assessments (id,batch_id,score,classification,assessment_json,digest,created_at) VALUES (?,?,?,?,?,?,?)",
        )
        .bind(
          saved!.id,
          saved!.batch_id,
          saved!.score,
          saved!.classification,
          saved!.assessment_json,
          saved!.digest,
          saved!.created_at,
        )
        .run();
    }
    expect(
      (await request<Verification>("/verify/BH-2026-000042")).data.verdict,
    ).toBe("AUTHENTIC");
  });
  it("rejects duplicate public IDs, duplicate fingerprints and unauthorized registrars", async () => {
    const account = privateKeyToAccount(key);
    const wallet = createWalletClient({ account, chain, transport: http(rpc) });
    const original = await request<Verification>("/verify/BH-2026-000042");
    await expect(
      publicClient.simulateContract({
        account,
        address: contract,
        abi: registryAbi,
        functionName: "registerRecord",
        args: [original.data.anchoredHash as Hex, "BH-2026-000999"],
      }),
    ).rejects.toThrow();
    await expect(
      publicClient.simulateContract({
        account,
        address: contract,
        abi: registryAbi,
        functionName: "registerRecord",
        args: [await sha256("different"), "BH-2026-000042"],
      }),
    ).rejects.toThrow();
    const outsider = privateKeyToAccount(generatePrivateKey());
    await expect(
      publicClient.simulateContract({
        account: outsider,
        address: contract,
        abi: registryAbi,
        functionName: "registerRecord",
        args: [await sha256("unauthorized"), "BH-2026-000998"],
      }),
    ).rejects.toThrow();
  });
});
