import { z } from "zod";
import { apiError } from "@/lib/api/responses";
import { requireApiRole } from "@/lib/auth/api-auth";
import { getActiveGrant } from "@/lib/staff/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(_request: Request, { params }: { params: Promise<{ documentId: string; packId: string }> }) {
  const auth = await requireApiRole("staff"); if ("errorResponse" in auth) return auth.errorResponse;
  const path = z.object({ documentId: z.uuid(), packId: z.uuid() }).safeParse(await params);
  if (!path.success || !auth.profile.organizationId || !await getActiveGrant(auth.supabase, path.data.packId, auth.profile.id, auth.profile.organizationId)) return apiError("ACCESS_EXPIRED", "This temporary access is unavailable or expired.", 404);
  const admin = createAdminClient();
  const { data: item } = await admin.from("service_pack_items").select("document_id").eq("service_pack_id", path.data.packId).eq("document_id", path.data.documentId).maybeSingle();
  if (!item) return apiError("DOCUMENT_NOT_SHARED", "This document is not included in the shared pack.", 404);
  const { data: document } = await admin.from("documents").select("storage_path").eq("id", path.data.documentId).is("deleted_at", null).maybeSingle();
  if (!document) return apiError("DOCUMENT_NOT_SHARED", "This document is unavailable.", 404);
  const { data, error } = await admin.storage.from("documents").createSignedUrl(document.storage_path, 60);
  if (error || !data) return apiError("PREVIEW_UNAVAILABLE", "The preview is temporarily unavailable.", 500);
  return Response.redirect(data.signedUrl, 302);
}
