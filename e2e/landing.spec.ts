import { expect, test } from "@playwright/test";

test("landing page presents the product promise without horizontal overflow", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Arrive ready the first time.",
    }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Create account" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Staff sign in" })).toBeVisible();

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
});

test("health endpoint reports that ReqDocs is available", async ({ request }) => {
  const response = await request.get("/health");

  expect(response.ok()).toBe(true);
  await expect(response.json()).resolves.toEqual({
    data: {
      service: "reqdocs",
      status: "ok",
    },
  });
});
