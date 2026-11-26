import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api/responses";
import { requireApiRole } from "@/lib/auth/api-auth";

const schema = z.object({ confirmation: z.literal(true) });
export async function POST(request: Request, { params }: { params: Promise<{ packId: string }> }) {
  const auth = await requireApiRole("staff"); if ("errorResponse" in auth) return auth.errorResponse;
  const id = z.uuid().safeParse((await params).packId); const body = schema.safeParse(await request.json().catch(() => null));
  if (!id.success || !body.success) return apiError("VALIDATION_ERROR", "Confirm that the documents were received.", 422);
  const { error } = await auth.supabase.rpc("confirm_pack_documents_received", { confirmation: true, target_pack_id: id.data });
  return error ? apiError("OUTCOME_FAILED", "This outcome could not be recorded. The temporary access may have expired.", 409) : apiSuccess({ message: "Documents received for processing." });
}
