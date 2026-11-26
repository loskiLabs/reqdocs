import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api/responses";
import { requireApiRole } from "@/lib/auth/api-auth";
import { listAccessHistory } from "@/lib/history/server";

const typeSchema = z.enum(["code_generated", "code_cancelled", "pack_viewed", "documents_received", "changes_requested"]);
export async function GET(request: Request) {
  const auth = await requireApiRole("individual"); if ("errorResponse" in auth) return auth.errorResponse;
  const url = new URL(request.url); const rawPack = url.searchParams.get("packId"); const rawType = url.searchParams.get("eventType");
  const packId = rawPack ? z.uuid().safeParse(rawPack) : null; const eventType = rawType ? typeSchema.safeParse(rawType) : null;
  if (packId && !packId.success || eventType && !eventType.success) return apiError("VALIDATION_ERROR", "The history filter is invalid.", 422);
  return apiSuccess(await listAccessHistory(auth.profile.id, { eventType: eventType?.data, packId: packId?.data }));
}
