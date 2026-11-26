import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api/responses";
import { requireApiRole } from "@/lib/auth/api-auth";
import {
  DOCUMENT_SELECT,
  documentFormStrings,
  documentInsertValues,
  getDocumentTypeRules,
  toDocumentSummary,
  type DocumentRow,
} from "@/lib/documents/server";
import { getJohannesburgToday } from "@/lib/documents/validity";
import {
  ALLOWED_DOCUMENT_MIME_TYPES,
  MAX_DOCUMENT_SIZE_BYTES,
  validateDocumentMetadata,
  validateUploadFile,
} from "@/lib/documents/upload-validation";
import { createAdminClient } from "@/lib/supabase/admin";
import { recalculateOwnedPacks } from "@/lib/packs/recalculate";

const querySchema = z.object({
  documentType: z.string().regex(/^[a-z0-9_]+$/).optional(),
  status: z
    .enum(["current", "expiring_soon", "expired", "no_expiry"])
    .optional(),
});

export async function GET(request: Request) {
  const auth = await requireApiRole("individual");
  if ("errorResponse" in auth) return auth.errorResponse;

  const url = new URL(request.url);
  const filters = querySchema.safeParse({
    documentType: url.searchParams.get("documentType") || undefined,
    status: url.searchParams.get("status") || undefined,
  });

  if (!filters.success) {
    return apiError(
      "VALIDATION_ERROR",
      "Choose a valid document filter.",
      422,
    );
  }

  let query = auth.supabase
    .from("documents")
    .select(DOCUMENT_SELECT)
    .eq("owner_id", auth.profile.id)
    .is("deleted_at", null)
    .order("valid_from", { ascending: false })
    .order("created_at", { ascending: false });

  if (filters.data.documentType) {
    query = query.eq("document_type_id", filters.data.documentType);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Unable to list Vault documents:", error.message);
    return apiError(
      "DOCUMENT_LIST_FAILED",
      "We could not load your documents. Try again.",
      500,
    );
  }

  const today = getJohannesburgToday();
  const documents = ((data ?? []) as unknown as DocumentRow[])
    .map((row) => toDocumentSummary(row, today))
    .filter(
      (document) =>
        !filters.data.status || document.status === filters.data.status,
    );

  return apiSuccess(documents);
}

export async function POST(request: Request) {
  const auth = await requireApiRole("individual");
  if ("errorResponse" in auth) return auth.errorResponse;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return apiError(
      "VALIDATION_ERROR",
      "Submit the document form again.",
      400,
    );
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
    const status =
      submittedFile instanceof File &&
      submittedFile.size > MAX_DOCUMENT_SIZE_BYTES
        ? 413
        : submittedFile instanceof File &&
            !ALLOWED_DOCUMENT_MIME_TYPES.includes(
              submittedFile.type as (typeof ALLOWED_DOCUMENT_MIME_TYPES)[number],
            )
          ? 415
          : 422;

    return apiError(
      "VALIDATION_ERROR",
      "Check the highlighted fields and try again.",
      status,
      fieldErrors,
    );
  }

  if (!metadata.success || !file.success || !file.file || !file.originalFilename) {
    return apiError("VALIDATION_ERROR", "Check the document and try again.", 422);
  }

  const documentId = crypto.randomUUID();
  const storagePath = `users/${auth.profile.id}/${documentId}/${crypto.randomUUID()}.${file.extension}`;
  const admin = createAdminClient();
  const { error: uploadError } = await admin.storage
    .from("documents")
    .upload(storagePath, file.file, {
      cacheControl: "private, max-age=0",
      contentType: file.mimeType,
      upsert: false,
    });

  if (uploadError) {
    console.error("Unable to upload a private document:", uploadError.message);
    return apiError(
      "DOCUMENT_UPLOAD_FAILED",
      "We could not upload this file. Try again.",
      500,
    );
  }

  const { data, error: insertError } = await auth.supabase
    .from("documents")
    .insert(
      documentInsertValues(
        documentId,
        auth.profile.id,
        storagePath,
        file.originalFilename,
        file.mimeType,
        file.file.size,
        metadata.data,
      ),
    )
    .select(DOCUMENT_SELECT)
    .single();

  if (insertError || !data) {
    await admin.storage.from("documents").remove([storagePath]);
    console.error(
      "Unable to save document metadata:",
      insertError?.message ?? "No row returned",
    );
    return apiError(
      "DOCUMENT_SAVE_FAILED",
      "The file was not saved. Check the details and try again.",
      500,
    );
  }

  await recalculateOwnedPacks(auth.supabase);

  return apiSuccess(
    toDocumentSummary(data as unknown as DocumentRow, getJohannesburgToday()),
    201,
  );
}
