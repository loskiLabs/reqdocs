import { redirect } from "next/navigation";
import { z } from "zod";
import { apiError } from "@/lib/api/responses";
import { requireApiRole } from "@/lib/auth/api-auth";
import { getOwnedDocument } from "@/lib/documents/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const auth = await requireApiRole("individual");
  if ("errorResponse" in auth) return auth.errorResponse;

  const parsedId = z.uuid().safeParse((await params).documentId);
  if (!parsedId.success) {
    return apiError(
      "DOCUMENT_NOT_FOUND",
      "This document is unavailable.",
      404,
    );
  }

  const document = await getOwnedDocument(
    auth.supabase,
    parsedId.data,
    auth.profile.id,
  );
  if (!document) {
    return apiError(
      "DOCUMENT_NOT_FOUND",
      "This document is unavailable.",
      404,
    );
  }

  const { data, error } = await createAdminClient()
    .storage.from("documents")
    .createSignedUrl(document.storage_path, 60);

  if (error || !data) {
    return apiError(
      "PREVIEW_UNAVAILABLE",
      "The preview is temporarily unavailable. Try again.",
      500,
    );
  }

  redirect(data.signedUrl);
}
