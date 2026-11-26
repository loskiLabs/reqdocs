import { z } from "zod";
import { hashAccessCode, hashRedemptionSource } from "@/lib/access-codes/crypto";
import { apiError, apiSuccess } from "@/lib/api/responses";
import { requireApiRole } from "@/lib/auth/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({ code: z.string().regex(/^\d{6}$/) });
const genericMessage = "This code is invalid or no longer available. Ask the user to generate a new code.";

export async function POST(request: Request) {
  const auth = await requireApiRole("staff");
  if ("errorResponse" in auth) return auth.errorResponse;
  const body = schema.safeParse(await request.json().catch(() => null));
  if (!body.success) return apiError("INVALID_ACCESS_CODE", genericMessage, 400);

  try {
    const codeHash = hashAccessCode(body.data.code);
    const admin = createAdminClient();
    const { data: candidate } = await admin.from("access_codes").select("service_pack_id").eq("code_hash", codeHash).is("used_at", null).is("cancelled_at", null).gt("expires_at", new Date().toISOString()).maybeSingle();
    if (candidate?.service_pack_id) await admin.rpc("recalculate_service_pack", { target_pack_id: candidate.service_pack_id });

    const source = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const { data, error } = await auth.supabase.rpc("redeem_pack_access_code", {
      target_code_hash: codeHash,
      target_ip_hash: hashRedemptionSource(source),
    });
    const result = Array.isArray(data) ? data[0] : null;
    if (error || !result || result.outcome === "invalid") return apiError("INVALID_ACCESS_CODE", genericMessage, 400);
    if (result.outcome === "rate_limited") return apiError("RATE_LIMITED", "Too many attempts. Wait 15 minutes before trying again.", 429);
    return apiSuccess({ grantExpiresAt: result.grant_expires_at, packId: result.pack_id });
  } catch {
    return apiError("INVALID_ACCESS_CODE", genericMessage, 400);
  }
}
