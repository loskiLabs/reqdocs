import process from "node:process";
import { createClient } from "@supabase/supabase-js";

try {
  process.loadEnvFile?.(".env.local");
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !publishableKey || !secretKey) {
  console.error("Live RLS verification requires the three Supabase environment values.");
  process.exit(1);
}

const admin = createClient(url, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const runId = crypto.randomUUID();
const password = `Rls-${crypto.randomUUID()}-Aa1`;
const emails = [
  `rls-owner-${runId}@reqdocs.test`,
  `rls-other-${runId}@reqdocs.test`,
];
const createdUserIds = [];

async function createTemporaryUser(email) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    password,
    user_metadata: { display_name: "Temporary RLS test user" },
  });
  if (error) throw error;
  createdUserIds.push(data.user.id);
  return data.user.id;
}

async function signedInClient(email) {
  const client = createClient(url, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}

try {
  const ownerId = await createTemporaryUser(emails[0]);
  await createTemporaryUser(emails[1]);
  const owner = await signedInClient(emails[0]);
  const other = await signedInClient(emails[1]);
  const documentId = crypto.randomUUID();
  const { error: insertError } = await owner.from("documents").insert({
    display_name: "Temporary fictional RLS record",
    document_type_id: "identity_document",
    duration_months: null,
    expires_on: null,
    expiry_method: "none",
    id: documentId,
    mime_type: "application/pdf",
    original_filename: "temporary-fictional.pdf",
    owner_id: ownerId,
    size_bytes: 32,
    storage_path: `users/${ownerId}/${documentId}/${crypto.randomUUID()}.pdf`,
    valid_from: "2026-08-01",
  });
  if (insertError) throw insertError;

  const { data: ownerView, error: ownerError } = await owner
    .from("documents")
    .select("id")
    .eq("id", documentId);
  if (ownerError || ownerView?.length !== 1) {
    throw new Error("The owner could not read their temporary document record.");
  }

  const { data: otherView, error: otherError } = await other
    .from("documents")
    .select("id")
    .eq("id", documentId);
  if (otherError || (otherView?.length ?? 0) !== 0) {
    throw new Error("Cross-user document metadata was not denied by RLS.");
  }

  console.log("Live RLS verification passed: owner allowed, other individual denied.");
} catch (error) {
  console.error(
    "Live RLS verification failed:",
    error instanceof Error ? error.message : "Unknown error",
  );
  process.exitCode = 1;
} finally {
  for (const userId of createdUserIds) {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) {
      console.error("Unable to remove a temporary RLS test account:", error.message);
      process.exitCode = 1;
    }
  }
}
