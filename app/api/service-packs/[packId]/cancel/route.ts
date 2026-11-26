import { z } from "zod";
import { apiError } from "@/lib/api/responses";
import { requireApiRole } from "@/lib/auth/api-auth";

export async function POST(_request: Request, { params }: { params: Promise<{ packId: string }> }) {
  const auth = await requireApiRole("individual");
  if ("errorResponse" in auth) return auth.errorResponse;
  const id = z.uuid().safeParse((await params).packId);
  if (!id.success) return apiError("PACK_NOT_FOUND", "This Service Pack is unavailable.", 404);
  const { error } = await auth.supabase.rpc("cancel_service_pack", { target_pack_id: id.data });
  return error
    ? apiError("PACK_CANCEL_FAILED", "This Service Pack cannot be cancelled.", 409)
    : new Response(null, { status: 204 });
}
