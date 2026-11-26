import type { SupabaseClient } from "@supabase/supabase-js";

export async function recalculateOwnedPacks(supabase: SupabaseClient) {
  const { error } = await supabase.rpc("recalculate_owner_service_packs");
  if (error && error.code !== "PGRST202") {
    console.error("Unable to recalculate active Service Packs:", error.message);
  }
}
