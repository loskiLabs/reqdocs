import { expect, test } from "@playwright/test";
import {
  calculateExpiryDate,
  getJohannesburgToday,
} from "../lib/documents/validity";

const demoPassword = process.env.DEMO_INDIVIDUAL_PASSWORD;

test.describe("Document Vault", () => {
  test.skip(!demoPassword, "Demo individual credentials are not configured.");

  test("individual uploads, views and soft-deletes a fictional document", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Email address").fill("demo.user@reqdocs.test");
    await page.getByLabel("Password", { exact: true }).fill(demoPassword ?? "");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.goto("/vault");
    const staleCards = page
      .getByRole("article")
      .filter({ hasText: "E2E Vault" });
    while ((await staleCards.count()) > 0) {
      const previousCount = await staleCards.count();
      page.once("dialog", (dialog) => dialog.accept());
      await staleCards.first().getByRole("button", { name: "Delete" }).click();
      await expect(staleCards).toHaveCount(previousCount - 1);
    }

    await page.goto("/vault/new");
    await page
      .getByLabel("Document type")
      .selectOption("certified_id_copy");
    const fixtureId = Date.now();
    const displayName = `E2E Vault fixture ${fixtureId}`;
    const validFrom = getJohannesburgToday();
    const expectedExpiry = calculateExpiryDate(validFrom, 3);
    await page.getByLabel("Display name").fill(displayName);
    await page.getByLabel(/^File/).setInputFiles({
      buffer: Buffer.from("%PDF-1.4\n% fictional ReqDocs test file\n%%EOF"),
      mimeType: "application/pdf",
      name: "fictional-certified-id.pdf",
    });
    await page
      .getByLabel("Valid-from, issue or certification date")
      .fill(validFrom);

    await expect(
      page.getByText(`Calculated expiry: ${expectedExpiry}.`),
    ).toBeVisible();
    await page.getByRole("button", { name: "Save document" }).click();

    await expect(page).toHaveURL(/\/vault\?added=1$/);
    const card = page.getByRole("article").filter({ hasText: displayName });
    await expect(card).toBeVisible();
    await expect(card).toContainText("Current");

    const previewPath = await card
      .getByRole("link", { name: "Preview" })
      .getAttribute("href");
    expect(previewPath).toMatch(/^\/api\/documents\/[0-9a-f-]+\/preview$/);
    const documentId = previewPath?.split("/")[3] ?? "";
    const metadataResponse = await page.request.get(
      `/api/documents/${documentId}`,
    );
    expect(metadataResponse.status()).toBe(200);
    const metadataBody = (await metadataResponse.json()) as {
      data: { previewUrl?: string; storagePath?: string };
    };
    expect(metadataBody.data.previewUrl).toMatch(/^https:\/\//);
    expect(metadataBody.data.storagePath).toBeUndefined();

    const previewResponse = await page.request.get(previewPath ?? "", {
      maxRedirects: 0,
    });
    expect([302, 303, 307, 308]).toContain(previewResponse.status());

    await card.getByRole("link", { name: "Replace" }).click();
    await expect(page).toHaveURL(/\/vault\/[0-9a-f-]+\/edit$/);
    const replacementName = `E2E Vault replacement ${fixtureId}`;
    await page.getByLabel("Display name").fill(replacementName);
    await page.getByLabel(/^Replacement file/).setInputFiles({
      buffer: Buffer.from("%PDF-1.4\n% fictional ReqDocs replacement\n%%EOF"),
      mimeType: "application/pdf",
      name: "fictional-certified-id-replacement.pdf",
    });
    await page.getByRole("button", { name: "Save replacement" }).click();
    await expect(page).toHaveURL(/\/vault\?replaced=1$/);
    const replacementCard = page
      .getByRole("article")
      .filter({ hasText: replacementName });
    await expect(replacementCard).toBeVisible();
    await expect(card).toHaveCount(0);

    for (const width of [320, 768, 1280]) {
      await page.setViewportSize({ height: 900, width });
      const hasHorizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      expect(hasHorizontalOverflow).toBe(false);
      await page.screenshot({
        fullPage: true,
        path: `.artifacts/vault-${width}.png`,
      });
    }

    await page.setViewportSize({ height: 900, width: 320 });
    await page.goto("/vault/new");
    await expect(page.getByLabel(/^File/)).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
    ).toBe(false);
    await page.screenshot({
      fullPage: true,
      path: ".artifacts/vault-form-320.png",
    });
    await page.goto("/vault");
    const cleanupCard = page
      .getByRole("article")
      .filter({ hasText: replacementName });

    page.once("dialog", (dialog) => dialog.accept());
    await cleanupCard.getByRole("button", { name: "Delete" }).click();
    await expect(cleanupCard).toHaveCount(0);
  });

  test("unauthenticated document metadata and preview requests are denied", async ({
    request,
  }) => {
    const documentId = "00000000-0000-4000-8000-000000000000";
    const metadata = await request.get(`/api/documents/${documentId}`);
    const preview = await request.get(`/api/documents/${documentId}/preview`, {
      maxRedirects: 0,
    });

    expect(metadata.status()).toBe(401);
    expect(preview.status()).toBe(401);
  });
});
