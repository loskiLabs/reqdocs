import { z } from "zod";
import { generateAccessCode, hashAccessCode } from "@/lib/access-codes/crypto";
import { apiError, apiSuccess } from "@/lib/api/responses";
import { requireApiRole } from "@/lib/auth/api-auth";
import { getOwnedPack } from "@/lib/packs/server";

export async function POST(_request: Request, { params }: { params: Promise<{ packId: string }> }) {
  const auth = await requireApiRole("individual");
  if ("errorResponse" in auth) return auth.errorResponse;
  const id = z.uuid().safeParse((await params).packId);
  if (!id.success) return apiError("PACK_NOT_FOUND", "This Service Pack is unavailable.", 404);
  const pack = await getOwnedPack(auth.supabase, id.data, auth.profile.id);
  if (!pack) return apiError("PACK_NOT_FOUND", "This Service Pack is unavailable.", 404);
  if (pack.readinessPercent !== 100) return apiError("PACK_NOT_READY", "Complete every requirement before sharing.", 409);

  try {
    const code = generateAccessCode();
    const { data: expiresAt, error } = await auth.supabase.rpc("create_pack_access_code", {
      target_code_hash: hashAccessCode(code),
      target_pack_id: pack.id,
    });
    if (error || typeof expiresAt !== "string") return apiError("ACCESS_CODE_UNAVAILABLE", "An access code could not be created. Check that no staff access is active.", 409);
    return apiSuccess({ code, expiresAt, lifetimeSeconds: 600 }, 201);
  } catch {
    return apiError("ACCESS_CODE_UNAVAILABLE", "Access-code security is not configured.", 500);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ packId: string }> }) {
  const auth = await requireApiRole("individual");
  if ("errorResponse" in auth) return auth.errorResponse;
  const id = z.uuid().safeParse((await params).packId);
  if (!id.success) return apiError("PACK_NOT_FOUND", "This Service Pack is unavailable.", 404);
  const { error } = await auth.supabase.rpc("cancel_pack_access_code", { target_pack_id: id.data });
  return error ? apiError("ACCESS_CODE_CANCEL_FAILED", "The access code could not be cancelled.", 409) : new Response(null, { status: 204 });
}
