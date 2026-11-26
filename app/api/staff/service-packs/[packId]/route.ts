import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api/responses";
import { requireApiRole } from "@/lib/auth/api-auth";
import { getGrantedStaffPack } from "@/lib/staff/server";

export async function GET(_request: Request, { params }: { params: Promise<{ packId: string }> }) {
  const auth = await requireApiRole("staff"); if ("errorResponse" in auth) return auth.errorResponse;
  const id = z.uuid().safeParse((await params).packId); if (!id.success || !auth.profile.organizationId) return apiError("ACCESS_EXPIRED", "This temporary access is unavailable or expired.", 404);
  const pack = await getGrantedStaffPack(auth.supabase, id.data, auth.profile.id, auth.profile.organizationId);
  return pack ? apiSuccess(pack) : apiError("ACCESS_EXPIRED", "This temporary access is unavailable or expired.", 404);
}
