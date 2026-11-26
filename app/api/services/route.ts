import { apiError, apiSuccess } from "@/lib/api/responses";
import { listServices } from "@/lib/packs/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    return apiSuccess(await listServices(createAdminClient()));
  } catch {
    return apiError("SERVICES_UNAVAILABLE", "Services are temporarily unavailable.", 500);
  }
}
