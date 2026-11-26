import process from "node:process";
import { createHmac, randomInt, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

try { process.loadEnvFile?.(".env.local"); } catch (error) { if (error?.code !== "ENOENT") throw error; }
for (const name of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "ACCESS_CODE_SECRET"]) if (!process.env[name]) throw new Error(`Missing ${name}`);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const secret = process.env.ACCESS_CODE_SECRET;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const createdUsers = [];
const hash = (code) => createHmac("sha256", secret).update(code).digest("hex");
const sourceHash = createHmac("sha256", secret).update("source:live-sharing-test").digest("hex");

async function createSession(role, organizationId = null) {
  const email = `sharing-${randomUUID()}@example.test`; const password = `Live-${randomUUID()}-Aa1!`;
  const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true, password, user_metadata: { display_name: `Fictional ${role} test` } });
  if (error || !data.user) throw error ?? new Error("User creation failed"); createdUsers.push(data.user.id);
  if (role === "staff") { const { error: profileError } = await admin.from("profiles").update({ organization_id: organizationId, role: "staff" }).eq("id", data.user.id); if (profileError) throw profileError; }
  const client = createClient(url, anon, { auth: { autoRefreshToken: false, persistSession: false } }); const { error: signInError } = await client.auth.signInWithPassword({ email, password }); if (signInError) throw signInError;
  return { client, id: data.user.id };
}

function code() { return randomInt(0, 1_000_000).toString().padStart(6, "0"); }
function outcome(data) { return Array.isArray(data) ? data[0]?.outcome : null; }

try {
  const owner = await createSession("individual");
  const ujStaff = await createSession("staff", "00000000-0000-4000-8000-000000000001");
  const vehicleStaff = await createSession("staff", "00000000-0000-4000-8000-000000000002");
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg" }).format(new Date());
  const types = ["certified_id_copy", "proof_academic_registration", "bursary_confirmation_letter", "external_bursary_allowance_form", "bank_confirmation_letter"];
  const docs = types.map((type) => ({ created_at: new Date().toISOString(), display_name: `Fictional ${type}`, document_type_id: type, duration_months: 3, expires_on: "2026-11-22", expiry_method: "duration", id: randomUUID(), mime_type: "application/pdf", original_filename: `${type}.pdf`, owner_id: owner.id, reference_year: ["proof_academic_registration", "bursary_confirmation_letter", "external_bursary_allowance_form"].includes(type) ? 2026 : null, signed_attested: type === "external_bursary_allowance_form", size_bytes: 32, storage_path: `users/${owner.id}/${randomUUID()}/fixture.pdf`, valid_from: today }));
  const { error: docsError } = await owner.client.from("documents").insert(docs); if (docsError) throw docsError;
  const { data: packId, error: packError } = await owner.client.rpc("create_service_pack", { target_service_id: "uj_external_bursary_allowance_2026" }); if (packError) throw packError;

  async function generate(readable = code()) { const { error } = await owner.client.rpc("create_pack_access_code", { target_code_hash: hash(readable), target_pack_id: packId }); if (error) throw error; return readable; }
  async function redeem(client, readable) { const result = await client.rpc("redeem_pack_access_code", { target_code_hash: hash(readable), target_ip_hash: sourceHash }); if (result.error) throw result.error; return outcome(result.data); }
  async function resetGrant() { await admin.from("pack_access_grants").update({ revoked_at: new Date().toISOString() }).eq("service_pack_id", packId).is("revoked_at", null); await admin.from("service_packs").update({ status: "ready" }).eq("id", packId); }

  const cancelled = await generate(); await owner.client.rpc("cancel_pack_access_code", { target_pack_id: packId }); if (await redeem(ujStaff.client, cancelled) !== "invalid") throw new Error("Cancelled code was accepted");
  const expired = await generate(); await admin.from("access_codes").update({ created_at: "2026-01-01T00:00:00Z", expires_at: "2026-01-01T00:10:00Z" }).eq("code_hash", hash(expired)); if (await redeem(ujStaff.client, expired) !== "invalid") throw new Error("Expired code was accepted");
  const wrongOrganization = await generate(); if (await redeem(vehicleStaff.client, wrongOrganization) !== "invalid") throw new Error("Wrong organisation was accepted"); await owner.client.rpc("cancel_pack_access_code", { target_pack_id: packId });
  const concurrent = await generate(); const attempts = await Promise.all([redeem(ujStaff.client, concurrent), redeem(ujStaff.client, concurrent)]); if (attempts.filter((value) => value === "success").length !== 1 || attempts.filter((value) => value === "invalid").length !== 1) throw new Error(`Concurrent redemption outcomes were ${attempts.join(", ")}`); if (await redeem(ujStaff.client, concurrent) !== "invalid") throw new Error("Used code was accepted");
  await resetGrant();
  const { data: events } = await admin.from("access_events").select("details").eq("service_pack_id", packId); const serialized = JSON.stringify(events ?? []); if (/\b\d{6}\b|https?:\/\//.test(serialized)) throw new Error("Audit details contain a code or URL");
  console.log("Live sharing checks passed: cancelled, expired, wrong-organisation, reused and concurrent redemption are safe.");
} catch (error) {
  console.error(
    error?.code === "PGRST202"
      ? "Live sharing checks require Supabase migrations through 20260822007000."
      : `Live sharing checks failed: ${error?.message ?? "Unknown error"}`,
  );
  process.exitCode = 1;
} finally {
  for (const id of createdUsers.reverse()) await admin.auth.admin.deleteUser(id);
}
