import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api/responses";
import { requireApiRole } from "@/lib/auth/api-auth";
import { documentHasActiveStaffGrant } from "@/lib/documents/active-grants";
import {
  DOCUMENT_SELECT,
  documentFormStrings,
  documentInsertValues,
  getDocumentTypeRules,
  getOwnedDocument,
  toDocumentSummary,
  type DocumentRow,
} from "@/lib/documents/server";
import { getJohannesburgToday } from "@/lib/documents/validity";
import {
  MAX_DOCUMENT_SIZE_BYTES,
  validateDocumentMetadata,
  validateUploadFile,
} from "@/lib/documents/upload-validation";
import { createAdminClient } from "@/lib/supabase/admin";
import { recalculateOwnedPacks } from "@/lib/packs/recalculate";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const auth = await requireApiRole("individual");
  if ("errorResponse" in auth) return auth.errorResponse;

  const parsedId = z.uuid().safeParse((await params).documentId);
  const currentDocument = parsedId.success
    ? await getOwnedDocument(auth.supabase, parsedId.data, auth.profile.id)
    : null;

  if (!currentDocument) {
    return apiError(
      "DOCUMENT_NOT_FOUND",
      "This document is unavailable.",
      404,
    );
  }

  try {
    if (await documentHasActiveStaffGrant(auth.supabase, currentDocument.id)) {
      return apiError(
        "DOCUMENT_CURRENTLY_SHARED",
        "This document cannot be replaced while staff access is active.",
        409,
      );
    }
  } catch {
    return apiError(
      "DOCUMENT_REPLACE_FAILED",
      "We could not replace this document. Try again.",
      500,
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return apiError("VALIDATION_ERROR", "Submit the document form again.", 400);
  }

  const raw = documentFormStrings(formData);
  const documentType = await getDocumentTypeRules(
    auth.supabase,
    raw.documentTypeId,
  );
  const metadata = validateDocumentMetadata(
    raw,
    documentType,
    getJohannesburgToday(),
  );
  const file = await validateUploadFile(formData.get("file"));
  const fieldErrors = {
    ...(!metadata.success ? metadata.fieldErrors : {}),
    ...(!file.success ? { file: file.message } : {}),
  };

  if (Object.keys(fieldErrors).length > 0) {
    const submittedFile = formData.get("file");
    return apiError(
      "VALIDATION_ERROR",
      "Check the highlighted fields and try again.",
      submittedFile instanceof File &&
        submittedFile.size > MAX_DOCUMENT_SIZE_BYTES
        ? 413
        : 422,
      fieldErrors,
    );
  }

  if (!metadata.success || !file.success || !file.file || !file.originalFilename) {
    return apiError("VALIDATION_ERROR", "Check the document and try again.", 422);
  }

  const replacementId = crypto.randomUUID();
  const storagePath = `users/${auth.profile.id}/${replacementId}/${crypto.randomUUID()}.${file.extension}`;
  const admin = createAdminClient();
  const { error: uploadError } = await admin.storage
    .from("documents")
    .upload(storagePath, file.file, {
      cacheControl: "private, max-age=0",
      contentType: file.mimeType,
      upsert: false,
    });

  if (uploadError) {
    return apiError(
      "DOCUMENT_UPLOAD_FAILED",
      "We could not upload this replacement. Try again.",
      500,
    );
  }

  const { data: replacement, error: insertError } = await auth.supabase
    .from("documents")
    .insert(
      documentInsertValues(
        replacementId,
        auth.profile.id,
        storagePath,
        file.originalFilename,
        file.mimeType,
        file.file.size,
        metadata.data,
        currentDocument.id,
      ),
    )
    .select(DOCUMENT_SELECT)
    .single();

  if (insertError || !replacement) {
    await admin.storage.from("documents").remove([storagePath]);
    return apiError(
      "DOCUMENT_REPLACE_FAILED",
      "The replacement was not saved. Try again.",
      500,
    );
  }

  const { error: archiveError } = await auth.supabase
    .from("documents")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", currentDocument.id)
    .eq("owner_id", auth.profile.id);

  if (archiveError) {
    await auth.supabase
      .from("documents")
      .delete()
      .eq("id", replacementId)
      .eq("owner_id", auth.profile.id);
    await admin.storage.from("documents").remove([storagePath]);
    return apiError(
      "DOCUMENT_REPLACE_FAILED",
      "The replacement was not saved. Try again.",
      500,
    );
  }

  await recalculateOwnedPacks(auth.supabase);

  return apiSuccess(
    toDocumentSummary(
      replacement as unknown as DocumentRow,
      getJohannesburgToday(),
    ),
    201,
  );
}
