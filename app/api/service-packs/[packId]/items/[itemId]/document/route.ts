import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api/responses";
import { requireApiRole } from "@/lib/auth/api-auth";
import { getOwnedPack } from "@/lib/packs/server";

const bodySchema = z.object({ documentId: z.uuid() });

export async function POST(request: Request, { params }: { params: Promise<{ itemId: string; packId: string }> }) {
  const auth = await requireApiRole("individual");
  if ("errorResponse" in auth) return auth.errorResponse;
  const path = await params;
  const ids = z.object({ itemId: z.uuid(), packId: z.uuid() }).safeParse(path);
  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!ids.success || !body.success) return apiError("VALIDATION_ERROR", "Choose a valid Vault document.", 422);

  const pack = await getOwnedPack(auth.supabase, ids.data.packId, auth.profile.id);
  const item = pack?.items.find((candidate) => candidate.id === ids.data.itemId);
  if (!pack || !item) return apiError("PACK_NOT_FOUND", "This Service Pack is unavailable.", 404);
  const { data: document } = await auth.supabase.from("documents").select("id, document_type_id").eq("id", body.data.documentId).eq("owner_id", auth.profile.id).is("deleted_at", null).maybeSingle();
  if (!document || document.document_type_id !== item.documentTypeId) return apiError("DOCUMENT_TYPE_MISMATCH", "That document does not match this requirement.", 422);

  const { error } = await auth.supabase.rpc("recalculate_service_pack", { target_pack_id: pack.id });
  if (error) return apiError("PACK_RECALCULATION_FAILED", "The Service Pack could not be recalculated.", 500);
  const refreshed = await getOwnedPack(auth.supabase, pack.id, auth.profile.id);
  return refreshed ? apiSuccess(refreshed) : apiError("PACK_NOT_FOUND", "This Service Pack is unavailable.", 404);
}
