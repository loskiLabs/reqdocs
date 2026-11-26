import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api/responses";
import { requireApiRole } from "@/lib/auth/api-auth";
import { documentHasActiveStaffGrant } from "@/lib/documents/active-grants";
import {
  getOwnedDocument,
  toDocumentSummary,
} from "@/lib/documents/server";
import { getJohannesburgToday } from "@/lib/documents/validity";
import { createAdminClient } from "@/lib/supabase/admin";
import { recalculateOwnedPacks } from "@/lib/packs/recalculate";

const documentIdSchema = z.uuid();

async function resolveOwnedDocument(
  rawDocumentId: string,
  auth: Exclude<Awaited<ReturnType<typeof requireApiRole>>, { errorResponse: Response }>,
) {
  const parsedId = documentIdSchema.safeParse(rawDocumentId);
  if (!parsedId.success) return null;

  return getOwnedDocument(auth.supabase, parsedId.data, auth.profile.id);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const auth = await requireApiRole("individual");
  if ("errorResponse" in auth) return auth.errorResponse;

  const { documentId } = await params;
  const document = await resolveOwnedDocument(documentId, auth);

  if (!document) {
    return apiError(
      "DOCUMENT_NOT_FOUND",
      "This document is unavailable.",
      404,
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from("documents")
    .createSignedUrl(document.storage_path, 60);

  if (error || !data) {
    console.error("Unable to create an owner preview URL:", error?.message);
    return apiError(
      "PREVIEW_UNAVAILABLE",
      "The preview is temporarily unavailable. Try again.",
      500,
    );
  }

  return apiSuccess({
    ...toDocumentSummary(document, getJohannesburgToday()),
    previewExpiresInSeconds: 60,
    previewUrl: data.signedUrl,
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const auth = await requireApiRole("individual");
  if ("errorResponse" in auth) return auth.errorResponse;

  const { documentId } = await params;
  const document = await resolveOwnedDocument(documentId, auth);

  if (!document) {
    return apiError(
      "DOCUMENT_NOT_FOUND",
      "This document is unavailable.",
      404,
    );
  }

  try {
    if (await documentHasActiveStaffGrant(auth.supabase, document.id)) {
      return apiError(
        "DOCUMENT_CURRENTLY_SHARED",
        "This document cannot be removed while staff access is active.",
        409,
      );
    }
  } catch (error) {
    console.error(
      "Unable to verify document grants:",
      error instanceof Error ? error.message : "Unknown error",
    );
    return apiError(
      "DOCUMENT_DELETE_FAILED",
      "We could not remove this document. Try again.",
      500,
    );
  }

  const { error } = await auth.supabase
    .from("documents")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", document.id)
    .eq("owner_id", auth.profile.id)
    .is("deleted_at", null);

  if (error) {
    console.error("Unable to soft-delete document:", error.message);
    return apiError(
      "DOCUMENT_DELETE_FAILED",
      "We could not remove this document. Try again.",
      500,
    );
  }

  await recalculateOwnedPacks(auth.supabase);

  return new Response(null, { status: 204 });
}
