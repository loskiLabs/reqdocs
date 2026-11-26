import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api/responses";
import { requireApiRole } from "@/lib/auth/api-auth";
import { getOwnedPack } from "@/lib/packs/server";

export async function GET(_request: Request, { params }: { params: Promise<{ packId: string }> }) {
  const auth = await requireApiRole("individual");
  if ("errorResponse" in auth) return auth.errorResponse;
  const id = z.uuid().safeParse((await params).packId);
  const pack = id.success ? await getOwnedPack(auth.supabase, id.data, auth.profile.id) : null;
  return pack ? apiSuccess(pack) : apiError("PACK_NOT_FOUND", "This Service Pack is unavailable.", 404);
}
