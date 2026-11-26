import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

export async function documentHasActiveStaffGrant(
  userClient: SupabaseClient,
  documentId: string,
): Promise<boolean> {
  const { data: items, error: itemError } = await userClient
    .from("service_pack_items")
    .select("service_pack_id")
    .eq("document_id", documentId);

  if (itemError) {
    throw new Error("Unable to check attached Service Packs.");
  }

  const packIds = [
    ...new Set((items ?? []).map((item) => item.service_pack_id)),
  ];

  if (packIds.length === 0) {
    return false;
  }

  const admin = createAdminClient();
  const { count, error: grantError } = await admin
    .from("pack_access_grants")
    .select("id", { count: "exact", head: true })
    .in("service_pack_id", packIds)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString());

  if (grantError) {
    throw new Error("Unable to check temporary document access.");
  }

  return (count ?? 0) > 0;
}
