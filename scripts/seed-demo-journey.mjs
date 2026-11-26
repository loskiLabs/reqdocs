import process from "node:process";
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

try { process.loadEnvFile?.(".env.local"); } catch (error) { if (error?.code !== "ENOENT") throw error; }
for (const name of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
  if (!process.env[name]) throw new Error(`Missing ${name}`);
}
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const today = new Intl.DateTimeFormat("en-CA", { day: "2-digit", month: "2-digit", timeZone: "Africa/Johannesburg", year: "numeric" }).format(new Date());
function shiftDays(value, days) { const date = new Date(`${value}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); }
function shiftMonths(value, months) { const [year, month, day] = value.split("-").map(Number); const targetIndex = month - 1 + months; const targetYear = year + Math.floor(targetIndex / 12); const targetMonth = targetIndex % 12; const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate(); return new Date(Date.UTC(targetYear, targetMonth, Math.min(day, lastDay))).toISOString().slice(0, 10); }

const { data: users, error: usersError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (usersError) throw usersError;
const owner = users.users.find((user) => user.email === "demo.user@reqdocs.test");
if (!owner) throw new Error("Run npm run seed:demo-users first.");
const file = await readFile(new URL("../public/forms/external-bursary-allowance-form-2026.pdf", import.meta.url));

const definitions = [
  ["31000000-0000-4000-8000-000000000001", "certified_id_copy", "Expired fictional certified ID", -125, false, null, "demo-expired-certified-id.pdf"],
  ["31000000-0000-4000-8000-000000000002", "proof_academic_registration", "Expiring 2026 registration proof", -80, false, 2026, "demo-registration-2026.pdf"],
  ["31000000-0000-4000-8000-000000000003", "bursary_confirmation_letter", "Fictional 2026 bursary letter", -20, false, 2026, "demo-bursary-letter-2026.pdf"],
  ["31000000-0000-4000-8000-000000000004", "bank_confirmation_letter", "Fictional bank confirmation", -20, false, null, "demo-bank-confirmation.pdf"],
  ["31000000-0000-4000-8000-000000000005", "identity_document", "Fictional identity document", -365, false, null, "demo-identity-document.pdf"],
  ["31000000-0000-4000-8000-000000000006", "proof_residential_address", "Fictional proof of address", -20, false, null, "demo-proof-of-address.pdf"],
  ["31000000-0000-4000-8000-000000000007", "vehicle_licence_alv_form", "Completed fictional ALV form", -20, true, null, "demo-completed-alv.pdf"],
];

for (const [id, type, displayName, offset, signed, referenceYear, filename] of definitions) {
  const validFrom = shiftDays(today, offset); const noExpiry = type === "identity_document"; const storagePath = `users/${owner.id}/${id}/demo.pdf`;
  const { error: storageError } = await supabase.storage.from("documents").upload(storagePath, file, { contentType: "application/pdf", upsert: true });
  if (storageError) throw storageError;
  const { error } = await supabase.from("documents").upsert({ created_at: new Date().toISOString(), deleted_at: null, display_name: displayName, document_type_id: type, duration_months: noExpiry ? null : 3, expires_on: noExpiry ? null : shiftMonths(validFrom, 3), expiry_method: noExpiry ? "none" : "duration", id, mime_type: "application/pdf", original_filename: filename, owner_id: owner.id, reference_year: referenceYear, signed_attested: signed, size_bytes: file.length, storage_path: storagePath, updated_at: new Date().toISOString(), valid_from: validFrom });
  if (error) throw error;
}

async function ensurePack(serviceId) {
  const { data: existing } = await supabase.from("service_packs").select("id").eq("owner_id", owner.id).eq("service_id", serviceId).not("status", "in", "(cancelled,documents_received)").maybeSingle();
  let packId = existing?.id;
  if (!packId) {
    packId = crypto.randomUUID();
    const { error } = await supabase.from("service_packs").insert({ id: packId, owner_id: owner.id, service_id: serviceId });
    if (error) throw error;
  }
  const { error } = await supabase.rpc("recalculate_service_pack", { target_pack_id: packId });
  if (error) throw error;
  return packId;
}

const ujPack = await ensurePack("uj_external_bursary_allowance_2026");
const vehiclePack = await ensurePack("motor_vehicle_licence_disc_renewal");
console.log(`Seeded fictional demo journey for ${today}.`);
console.log(`UJ pack (incomplete): ${ujPack}`);
console.log(`Vehicle pack (prepared): ${vehiclePack}`);
