import { createClient } from "@supabase/supabase-js";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { getJohannesburgToday } from "../lib/documents/validity";

const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.DEMO_UJ_STAFF_PASSWORD);
const pdf = { buffer: Buffer.from("%PDF-1.4\n% fictional ReqDocs journey fixture\n%%EOF"), mimeType: "application/pdf", name: "fictional-demo.pdf" };

function shiftMonths(date: string, months: number) {
  const [year, month, day] = date.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1 + months, day));
  return value.toISOString().slice(0, 10);
}

async function upload(request: APIRequestContext, values: { displayName: string; documentTypeId: string; referenceYear?: string; signedAttested?: string; validFrom: string }) {
  const response = await request.post("/api/documents", { multipart: { description: "Fictional automated journey fixture", displayName: values.displayName, documentTypeId: values.documentTypeId, durationMonths: "3", expiresOn: "", expiryMethod: "duration", file: pdf, issuer: "Fictional Demo Issuer", referenceYear: values.referenceYear ?? "", signedAttested: values.signedAttested ?? "false", validFrom: values.validFrom } });
  expect(response.status()).toBe(201);
  return (await response.json() as { data: { id: string } }).data.id;
}

test.describe("complete bursary journey", () => {
  test.skip(!configured, "Hosted demo configuration is unavailable.");
  test("individual prepares, shares and sees the staff outcome", async ({ page }) => {
    test.setTimeout(120_000);
    test.skip(test.info().project.name !== "desktop-chromium", "The database-backed journey runs once; responsive checks run separately.");
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
    async function removeJourneyUser(userId: string) {
      const { data: paths } = await admin.from("documents").select("storage_path").eq("owner_id", userId);
      if (paths?.length) await admin.storage.from("documents").remove(paths.map((row) => row.storage_path));
      await admin.auth.admin.deleteUser(userId);
    }
    const { data: existingUsers } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    for (const user of existingUsers.users.filter((candidate) => candidate.email?.startsWith("journey-") && candidate.email.endsWith("@example.test"))) {
      await removeJourneyUser(user.id);
    }
    const capability = await admin.rpc("recalculate_service_pack", { target_pack_id: "00000000-0000-4000-8000-000000000000" });
    test.skip(capability.error?.code === "PGRST202", "Service Pack migrations have not been applied to hosted Supabase.");
    const run = `${Date.now()}-${test.info().project.name.replace(/\W/g, "")}`;
    const email = `journey-${run}@example.test`; const password = `Demo-${run}-Aa1!`;
    const { data: created, error: createError } = await admin.auth.admin.createUser({ email, email_confirm: true, password, user_metadata: { display_name: "Fictional Journey User" } });
    expect(createError).toBeNull(); const ownerId = created.user?.id; expect(ownerId).toBeTruthy();
    const documentIds: string[] = [];
    try {
      await page.goto("/login"); await page.getByLabel("Email address").fill(email); await page.getByLabel("Password", { exact: true }).fill(password); await page.getByRole("button", { name: "Sign in" }).click(); await expect(page).toHaveURL(/\/dashboard$/);
      const today = getJohannesburgToday();
      const expiredId = await upload(page.request, { displayName: `Journey expired ID ${run}`, documentTypeId: "certified_id_copy", validFrom: shiftMonths(today, -4) }); documentIds.push(expiredId);
      documentIds.push(await upload(page.request, { displayName: `Journey registration ${run}`, documentTypeId: "proof_academic_registration", referenceYear: "2026", validFrom: today }));
      documentIds.push(await upload(page.request, { displayName: `Journey bursary letter ${run}`, documentTypeId: "bursary_confirmation_letter", referenceYear: "2026", validFrom: today }));
      documentIds.push(await upload(page.request, { displayName: `Journey bank letter ${run}`, documentTypeId: "bank_confirmation_letter", validFrom: today }));
      const createPack = await page.request.post("/api/service-packs", { data: { serviceId: "uj_external_bursary_allowance_2026" } }); expect(createPack.status()).toBe(201);
      let pack = (await createPack.json() as { data: { id: string; readinessPercent: number } }).data; expect(pack.readinessPercent).toBeLessThan(100);
      const replacementResponse = await page.request.post(`/api/documents/${expiredId}/replace`, { multipart: { description: "Fictional current replacement", displayName: `Journey current ID ${run}`, documentTypeId: "certified_id_copy", durationMonths: "3", expiresOn: "", expiryMethod: "duration", file: pdf, issuer: "Fictional Demo Issuer", referenceYear: "", signedAttested: "false", validFrom: today } }); expect(replacementResponse.status()).toBe(201); documentIds.push((await replacementResponse.json() as { data: { id: string } }).data.id);
      documentIds.push(await upload(page.request, { displayName: `Journey signed allowance form ${run}`, documentTypeId: "external_bursary_allowance_form", referenceYear: "2026", signedAttested: "true", validFrom: today }));
      const packResponse = await page.request.get(`/api/service-packs/${pack.id}`); pack = (await packResponse.json() as { data: { id: string; readinessPercent: number } }).data; expect(pack.readinessPercent).toBe(100);
      await page.goto(`/packs/${pack.id}`); await expect(page.getByText("100% ready")).toBeVisible();
      const codeResponse = await page.request.post(`/api/service-packs/${pack.id}/access-code`); expect(codeResponse.status()).toBe(201); const code = (await codeResponse.json() as { data: { code: string } }).data.code;
      await page.getByRole("button", { name: "Sign out" }).click(); await page.goto("/staff/login"); await page.getByLabel("Email address").fill("finance.staff@reqdocs.test"); await page.getByLabel("Password", { exact: true }).fill(process.env.DEMO_UJ_STAFF_PASSWORD!); await page.getByRole("button", { name: "Sign in", exact: true }).click(); await expect(page).toHaveURL(/\/staff$/);
      await page.getByLabel("Six-digit access code").fill(code); await page.getByRole("button", { name: "Open Service Pack" }).click(); await expect(page).toHaveURL(new RegExp(`/staff/packs/${pack.id}$`)); await expect(page.getByRole("heading", { name: "Shared documents" })).toBeVisible();
      const received = await page.request.post(`/api/staff/service-packs/${pack.id}/documents-received`, { data: { confirmation: true } }); expect(received.status()).toBe(200);
      await page.getByRole("button", { name: "Sign out" }).click();
      await expect(page).toHaveURL(/\/staff\/login$/);
      await page.goto("/login");
      await page.getByLabel("Email address").fill(email);
      await page.getByLabel("Password", { exact: true }).fill(password);
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await expect(page).toHaveURL(/\/dashboard$/);
      await page.goto("/history");
      await expect(page.getByRole("heading", { level: 1, name: "Access History" })).toBeVisible();
      await expect(page.getByText("Documents received for processing", { exact: true })).toBeVisible();
    } finally {
      if (ownerId) {
        await removeJourneyUser(ownerId);
      }
    }
  });
});
