import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync, writeFileSync } from "node:fs";
mkdirSync(".local", { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: "reduce",
});
const page = await context.newPage();
const results = [];
async function audit(route) {
  await page.goto("http://localhost:5174" + route);
  await page.waitForLoadState("networkidle");
  if (route === "/") {
    await page.locator(".home-architecture-section").scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    await page.evaluate(() => window.scrollTo(0, 0));
  }
  const a = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  results.push({
    route,
    width: page.viewportSize().width,
    overflow: await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    ),
    violations: a.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        summary: n.failureSummary,
      })),
    })),
  });
}
try {
  for (const route of [
    "/",
    "/verify",
    "/verify/BH-2026-000042",
    "/verify/BH-2026-999999",
    "/login",
    "/architecture",
  ])
    await audit(route);
  await page.goto("http://localhost:5174/login");
  await page.getByRole("button", { name: "Demo admin", exact: true }).click();
  await page.getByRole("button", { name: "Enter demo workspace" }).click();
  await page.locator(".workspace-main").waitFor();
  const routes = [
    "/dashboard",
    "/hives",
    "/hives/HIVE-0042",
    "/hives/HIVE-0042/readings",
    "/batches",
    "/batches/new",
    "/batches/BH-2026-000042",
    "/scan",
    "/scan/SCAN-TWIN001",
    "/scan/SCAN-SITE001",
    "/scan/SCAN-BROOD01",
    "/forecast",
    "/authority",
    "/authority/alerts",
    "/authority/records",
    "/demo/tamper",
  ];
  for (const route of routes) await audit(route);
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of [
    "/",
    "/verify/BH-2026-000042",
    "/architecture",
    "/dashboard",
    "/hives/HIVE-0042",
    "/batches/new",
    "/scan",
    "/scan/SCAN-TWIN001",
    "/forecast",
    "/authority",
    "/demo/tamper",
  ])
    await audit(route);
} finally {
  writeFileSync(
    ".local/accessibility-audit.json",
    JSON.stringify(results, null, 2),
  );
  console.log(
    JSON.stringify(
      results.map((r) => ({
        route: r.route,
        width: r.width,
        overflow: r.overflow,
        violations: r.violations.map((v) => ({
          id: v.id,
          count: v.nodes.length,
        })),
      })),
      null,
      2,
    ),
  );
  await browser.close();
  if (results.some((r) => r.overflow || r.violations.length))
    process.exitCode = 1;
}
