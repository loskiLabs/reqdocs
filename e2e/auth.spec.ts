import { expect, test } from "@playwright/test";

test("individual registration exposes no role choice and preserves valid input", async ({
  page,
}) => {
  await page.goto("/register");

  await expect(
    page.getByRole("heading", { level: 1, name: "Prepare once. Arrive ready." }),
  ).toBeVisible();
  await expect(page.getByText("Public accounts are always created")).toBeVisible();
  await expect(page.getByLabel(/role/i)).toHaveCount(0);

  await page.getByLabel("Display name").fill("Fictional User");
  await page.getByLabel("Email address").fill("fictional@example.test");
  await page.getByLabel("Password", { exact: true }).fill("SecurePass1");
  await page.getByLabel("Confirm password").fill("DifferentPass1");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.locator("#registration-status-summary")).toBeFocused();
  await expect(page.getByText("The passwords do not match.")).toBeVisible();
  await expect(page.getByLabel("Display name")).toHaveValue("Fictional User");
  await expect(page.getByLabel("Email address")).toHaveValue(
    "fictional@example.test",
  );
});

test("individual sign-in can be completed with the keyboard", async ({ page }) => {
  await page.goto("/login");

  const email = page.getByLabel("Email address");
  await email.focus();
  await page.keyboard.type("fictional@example.test");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.type("SecurePass1");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");

  await expect(page.locator("#login-error-summary")).toBeFocused();
  await expect(
    page.getByText(
      process.env.NEXT_PUBLIC_SUPABASE_URL
        ? /email or password is incorrect/i
        : /temporarily unavailable/i,
    ),
  ).toBeVisible();
});

test("staff portal is distinct and has no registration link", async ({ page }) => {
  await page.goto("/staff/login");

  await expect(page.getByText("Staff portal", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Review only what was shared",
    }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /create an account/i })).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Use individual sign in" }),
  ).toBeVisible();
});

test("protected workspaces send unauthenticated users to the correct portal", async ({
  page,
}) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);

  await page.goto("/staff");
  await expect(page).toHaveURL(/\/staff\/login$/);
});
