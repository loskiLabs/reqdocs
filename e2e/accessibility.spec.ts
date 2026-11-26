import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

async function expectNoSeriousViolations(page: import("@playwright/test").Page) {
  const results = await new AxeBuilder({ page }).analyze();
  const violations = results.violations.filter((violation) => violation.impact === "critical" || violation.impact === "serious");
  expect(violations, violations.map((violation) => `${violation.id}: ${violation.help}`).join("\n")).toEqual([]);
}

async function signInDemoIndividual(page: import("@playwright/test").Page) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.goto("/login");
    await page.getByLabel("Email address").fill("demo.user@reqdocs.test");
    await page.getByLabel("Password", { exact: true }).fill(process.env.DEMO_INDIVIDUAL_PASSWORD ?? "");
    await page.getByRole("button", { name: "Sign in" }).click();
    if (/\/dashboard$/.test(page.url())) return;
    await page.waitForTimeout(500 * (attempt + 1));
  }
  await expect(page).toHaveURL(/\/dashboard$/);
}

const corePages = [
  { heading: /Welcome,/, path: "/dashboard" },
  { heading: "Document Vault", path: "/vault" },
  { heading: "Add a document", path: "/vault/new" },
  { heading: "Service Packs", path: "/packs" },
  { heading: "Choose a service", path: "/packs/new" },
  { heading: "Access History", path: "/history" },
] as const;

async function openSettledCorePage(
  page: import("@playwright/test").Page,
  target: (typeof corePages)[number],
) {
  await page.goto(target.path, { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { level: 1, name: target.heading }),
  ).toBeVisible({ timeout: 15_000 });
}

test("public authentication pages have no serious automated accessibility violations", async ({ page }) => {
  test.setTimeout(60_000);
  for (const path of ["/", "/login", "/register", "/staff/login"]) {
    await page.goto(path);
    await expectNoSeriousViolations(page);
  }
});

test.describe("authenticated individual accessibility", () => {
  test.skip(!process.env.DEMO_INDIVIDUAL_PASSWORD, "Demo credentials are not configured.");
  test("core individual pages have no serious automated accessibility violations", async ({ page }) => {
    test.setTimeout(90_000);
    await signInDemoIndividual(page);
    for (const target of corePages) {
      await openSettledCorePage(page, target);
      await expectNoSeriousViolations(page);
    }
  });

  test("core individual pages do not overflow at required widths", async ({ page }) => {
    test.setTimeout(90_000);
    test.skip(test.info().project.name !== "desktop-chromium", "One browser checks all three explicit widths.");
    await signInDemoIndividual(page);
    for (const target of corePages) {
      await openSettledCorePage(page, target);
      for (const width of [320, 768, 1280]) {
        await page.setViewportSize({ height: 900, width });
        expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), `${target.path} overflowed at ${width}px`).toBe(false);
        if (target.path === "/packs/new") {
          await page.screenshot({ fullPage: true, path: `.artifacts/service-selector-${width}.png` });
        }
      }
    }
  });
});
