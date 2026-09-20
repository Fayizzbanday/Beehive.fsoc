import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
async function login(page: Page, role = "Producer") {
  await page.goto("/login");
  await page.getByRole("button", { name: role, exact: true }).click();
  await page.getByRole("button", { name: "Enter demo workspace" }).click();
  await expect(page.locator(".workspace-main")).toBeVisible();
}
test("producer creates a real contract-backed passport from simulated hive readings", async ({
  page,
  browser,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page);
  await expect(
    page.getByRole("heading", { name: "Good to see you, Aarav." }),
  ).toBeVisible();
  await page.goto("/hives/HIVE-0042");
  await expect(
    page.getByRole("heading", { name: "Acacia ridge", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Simulate Hive Stress" }).click();
  await expect(
    page.getByText("Your colony needs a closer look."),
  ).toBeVisible();
  await expect(
    page.getByText("Hive conditions need attention", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Simulate Healthy Data" }).click();
  await expect(page.getByText("A colony in balance.")).toBeVisible();
  await page.goto("/batches/new");
  await page.getByLabel("Source apiary").selectOption("apiary-lidder");
  await page.getByLabel(/Acacia ridge/).check();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel("Lot reference").fill(`E2E-${Date.now()}`);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByRole("button", { name: "Create record", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Run risk analysis", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Screening complete" }),
  ).toBeVisible();
  await expect(
    page.getByText(/Metadata risk and anomaly screening/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Continue to proof" }).click();
  await page.getByRole("button", { name: "Generate & anchor proof" }).click();
  await expect(
    page.getByRole("heading", { name: "Your honey has a passport." }),
  ).toBeVisible({ timeout: 40000 });
  await expect(page.getByAltText(/QR code containing/)).toBeVisible();
  const publicLink = await page
    .getByRole("link", { name: "Open public passport" })
    .getAttribute("href");
  expect(publicLink).toMatch(/^\/verify\/BH-2026-/);
  const reportDownload = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download traceability report" })
    .click();
  const report = await reportDownload;
  const reportPath = testInfo.outputPath("traceability-report.json");
  await report.saveAs(reportPath);
  const payload = JSON.parse(await readFile(reportPath, "utf8"));
  expect(payload.verification.verdict).toBe("AUTHENTIC");
  expect(payload.verificationUrl).toBe(`http://localhost:5174${publicLink}`);
  const consumer = await browser.newContext();
  const publicPage = await consumer.newPage();
  await publicPage.goto(`http://localhost:5174${publicLink}`);
  await expect(
    publicPage.getByText("Verified BeeHive record", { exact: true }),
  ).toBeVisible();
  await publicPage
    .getByRole("button", { name: "View Technical Proof" })
    .last()
    .click();
  await expect(publicPage.getByRole("dialog")).toBeVisible();
  const hashes = await publicPage
    .locator(".technical-proof .hash-block code")
    .allTextContents();
  expect(hashes[0]).toBe(hashes[1]);
  expect(hashes[2]).toMatch(/^0x[a-f0-9]{64}$/);
  await publicPage.getByRole("button", { name: "Close", exact: true }).click();
  await consumer.close();
  expect(errors).toEqual([]);
});
test("golden demo: authentic → tampered → authority incident → restored", async ({
  page,
  browser,
}) => {
  await login(page, "Demo admin");
  await page.goto("/demo/tamper");
  const restore = page.getByRole("button", { name: "Restore Demo" });
  if (await restore.isEnabled()) await restore.click();
  await expect(
    page.getByRole("heading", { name: "AUTHENTIC", exact: true }),
  ).toBeVisible();
  const original = await page.locator(".comparison-hash").last().textContent();
  await page
    .getByRole("button", { name: "Simulate Database Tampering" })
    .click();
  await expect(
    page.getByRole("heading", { name: "RECORD TAMPERED" }),
  ).toBeVisible();
  expect(await page.locator(".comparison-hash").last().textContent()).toBe(
    original,
  );
  expect(await page.locator(".comparison-hash").first().textContent()).not.toBe(
    original,
  );
  const consumer = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const phone = await consumer.newPage();
  await phone.goto("http://localhost:5174/verify/BH-2026-000042");
  await expect(
    phone.getByRole("heading", { name: "This record has been changed." }),
  ).toBeVisible();
  await expect(phone.getByText("250 kg", { exact: true })).toBeVisible();
  await phone.screenshot({
    path: ".local/mobile-tampered.png",
    fullPage: true,
  });
  await page.goto("/authority/alerts");
  await expect(
    page.getByText("Integrity mismatch: BH-2026-000042", { exact: true }),
  ).toBeVisible();
  await page.goto("/demo/tamper");
  await page.getByRole("button", { name: "Restore Demo" }).click();
  await expect(
    page.getByRole("heading", { name: "AUTHENTIC", exact: true }),
  ).toBeVisible();
  await phone.reload();
  await expect(
    phone.getByText("Verified BeeHive record", { exact: true }),
  ).toBeVisible();
  await expect(phone.getByText("25 kg", { exact: true })).toBeVisible();
  await phone.screenshot({
    path: ".local/mobile-passport.png",
    fullPage: true,
  });
  expect(
    await phone.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await consumer.close();
});
test("homepage sequence and architecture scenarios are interactive", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "From hive",
  );
  await page.screenshot({ path: ".local/home-desktop.png" });
  await page.getByRole("link", { name: "Explore the trust chain" }).click();
  await page
    .getByRole("button", { name: "Pause animation", exact: true })
    .click();
  const state = await page.locator(".trust-chain").getAttribute("data-state");
  await page.waitForTimeout(1700);
  expect(await page.locator(".trust-chain").getAttribute("data-state")).toBe(
    state,
  );
  await page
    .getByRole("button", { name: "Explain AI analyze", exact: true })
    .click();
  await expect(page.locator(".trust-chain")).toHaveAttribute(
    "data-state",
    "analyzing",
  );
  await expect(
    page.getByText("AI finds what deserves attention."),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Restart animation", exact: true })
    .click();
  await expect(page.locator(".trust-chain")).toHaveAttribute(
    "data-state",
    "idle",
  );
  await page.goto("/architecture");
  await page
    .getByRole("button", { name: "Tampering Attack", exact: true })
    .click();
  await expect(page.locator(".architecture-story h3")).toHaveText(
    "Tampering Attack",
  );
  await expect(page.locator(".system-architecture")).toHaveClass(
    /architecture-attack/,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Open menu", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Open menu", exact: true }).click();
  await expect(
    page.getByRole("navigation", { name: "Main navigation" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close menu", exact: true }).click();
  await page.screenshot({ path: ".local/home-mobile.png", fullPage: true });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("reduced motion, public accessibility, and keyboard proof drawer", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.locator(".trust-chain").scrollIntoViewIfNeeded();
  await expect(
    page.getByRole("button", { name: "Advance animation" }),
  ).toBeVisible();
  const state = await page.locator(".trust-chain").getAttribute("data-state");
  await page.waitForTimeout(1600);
  expect(await page.locator(".trust-chain").getAttribute("data-state")).toBe(
    state,
  );
  await page.goto("/verify/BH-2026-000042");
  await expect(
    page.getByText("Verified BeeHive record", { exact: true }),
  ).toBeVisible();
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  const issues = accessibility.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    nodes: v.nodes.map((n) => ({
      target: n.target,
      summary: n.failureSummary,
    })),
  }));
  await test.info().attach("accessibility", {
    body: JSON.stringify(issues, null, 2),
    contentType: "application/json",
  });
  expect(issues).toEqual([]);
  const proof = page
    .getByRole("button", { name: "View Technical Proof" })
    .last();
  await proof.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(proof).toBeFocused();
});
test("AI vision scan reports and the market risk forecast stay grounded in real data", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page);
  await page.goto("/scan");
  await expect(
    page.getByRole("heading", { name: "Scan a hive, a frame, or a site." }),
  ).toBeVisible();
  await expect(page.getByRole("radio")).toHaveCount(4);
  await page.getByRole("radio", { name: /Digital twin/ }).click();
  await expect(
    page.getByRole("radio", { name: /Digital twin/ }),
  ).toHaveAttribute("aria-checked", "true");
  await expect(page.getByText(/the same clip always returns/)).toBeVisible();
  await page.getByRole("link", { name: /SCAN-TWIN001/ }).click();
  await expect(
    page.getByRole("heading", { name: "Digital twin", level: 1 }),
  ).toBeVisible();
  await expect(page.getByText("Simulated prototype scan")).toBeVisible();
  await expect(page.getByText("Modelled hive weight")).toBeVisible();
  await expect(page.locator(".twin-hive svg")).toBeVisible();
  await expect(
    page.getByText(/Expect roughly .* kg of extractable honey/),
  ).toBeVisible();
  await expect(page.getByText(/never enters the certified record/)).toHaveCount(
    0,
  );
  await expect(page.getByText(/not a diagnostic instrument/)).toBeVisible();
  await page.goto("/scan/SCAN-SITE001");
  await expect(page.getByText("Where to put the hive")).toBeVisible();
  await expect(page.locator(".placement-spots .spot")).toHaveCount(3);
  await page.goto("/forecast");
  await expect(
    page.getByRole("heading", { name: "Predicted reputation risk" }),
  ).toBeVisible();
  const reviewCount = page.locator(".review-feed li");
  await expect(reviewCount.first()).toBeVisible();
  const before = await page
    .locator(".scan-verdict .badge", { hasText: "reviews" })
    .innerText();
  await page.getByRole("button", { name: "Receive a consumer review" }).click();
  await expect(page.getByText("A new consumer review landed.")).toBeVisible();
  await expect
    .poll(async () =>
      page.locator(".scan-verdict .badge", { hasText: "reviews" }).innerText(),
    )
    .not.toBe(before);
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    accessibility.violations.map((v) => ({ id: v.id, impact: v.impact })),
  ).toEqual([]);
  expect(errors).toEqual([]);
});
