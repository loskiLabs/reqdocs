import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api/responses";
import { requireApiRole } from "@/lib/auth/api-auth";
import { getOwnedPack } from "@/lib/packs/server";

export async function POST(_request: Request, { params }: { params: Promise<{ packId: string }> }) {
  const auth = await requireApiRole("individual");
  if ("errorResponse" in auth) return auth.errorResponse;
  const id = z.uuid().safeParse((await params).packId);
  if (!id.success) return apiError("PACK_NOT_FOUND", "This Service Pack is unavailable.", 404);
  const { error } = await auth.supabase.rpc("recalculate_service_pack", { target_pack_id: id.data });
  if (error) return apiError("PACK_RECALCULATION_FAILED", "The Service Pack could not be recalculated.", 500);
  const pack = await getOwnedPack(auth.supabase, id.data, auth.profile.id);
  return pack ? apiSuccess(pack) : apiError("PACK_NOT_FOUND", "This Service Pack is unavailable.", 404);
}
