import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api/responses";
import { requireApiRole } from "@/lib/auth/api-auth";

const schema = z.object({ itemIds: z.array(z.uuid()).min(1).max(10), reason: z.string().trim().min(10).max(500) });
export async function POST(request: Request, { params }: { params: Promise<{ packId: string }> }) {
  const auth = await requireApiRole("staff"); if ("errorResponse" in auth) return auth.errorResponse;
  const id = z.uuid().safeParse((await params).packId); const body = schema.safeParse(await request.json().catch(() => null));
  if (!id.success || !body.success) return apiError("VALIDATION_ERROR", "Choose at least one item and enter a reason of 10 to 500 characters.", 422);
  const { error } = await auth.supabase.rpc("request_pack_changes", { target_item_ids: body.data.itemIds, target_pack_id: id.data, target_reason: body.data.reason });
  return error ? apiError("OUTCOME_FAILED", "This request could not be recorded. The temporary access may have expired.", 409) : apiSuccess({ message: "Changes requested." });
}
