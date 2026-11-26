import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api/responses";
import { requireApiRole } from "@/lib/auth/api-auth";
import { getOwnedPack, listOwnedPacks } from "@/lib/packs/server";

const createSchema = z.object({ serviceId: z.string().regex(/^[a-z0-9_]+$/) });

export async function GET() {
  const auth = await requireApiRole("individual");
  if ("errorResponse" in auth) return auth.errorResponse;
  try {
    return apiSuccess(await listOwnedPacks(auth.supabase, auth.profile.id));
  } catch {
    return apiError("PACKS_UNAVAILABLE", "Service Packs are temporarily unavailable.", 500);
  }
}

export async function POST(request: Request) {
  const auth = await requireApiRole("individual");
  if ("errorResponse" in auth) return auth.errorResponse;
  const body = createSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return apiError("VALIDATION_ERROR", "Choose a valid service.", 422);

  const { data: packId, error } = await auth.supabase.rpc("create_service_pack", {
    target_service_id: body.data.serviceId,
  });
  if (error || typeof packId !== "string") {
    const conflict = error?.code === "23505";
    return apiError(
      conflict ? "ACTIVE_PACK_EXISTS" : "PACK_CREATE_FAILED",
      conflict ? "You already have an active pack for this service." : "We could not create this Service Pack. Try again.",
      conflict ? 409 : 500,
    );
  }
  const pack = await getOwnedPack(auth.supabase, packId, auth.profile.id);
  return pack ? apiSuccess(pack, 201) : apiError("PACK_CREATE_FAILED", "The Service Pack could not be loaded.", 500);
}
