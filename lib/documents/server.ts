import type { SupabaseClient } from "@supabase/supabase-js";
import {
  calculateDocumentStatus,
  getRemainingDaysMessage,
  getStatusLabel,
  type DocumentStatus,
  type ExpiryMethod,
} from "./validity";
import type { DocumentTypeRules } from "./upload-validation";

export type DocumentRow = {
  created_at: string;
  deleted_at: string | null;
  description: string | null;
  display_name: string;
  document_type_id: string;
  document_types: { label: string } | { label: string }[] | null;
  duration_months: number | null;
  expires_on: string | null;
  expiry_method: ExpiryMethod;
  id: string;
  issuer: string | null;
  mime_type: string;
  original_filename: string;
  owner_id: string;
  reference_year: number | null;
  signed_attested: boolean;
  size_bytes: number;
  storage_path: string;
  supersedes_document_id: string | null;
  updated_at: string;
  valid_from: string;
};

export type DocumentSummary = {
  createdAt: string;
  description: string | null;
  displayName: string;
  documentTypeId: string;
  documentTypeLabel: string;
  durationMonths: number | null;
  expiresOn: string | null;
  expiryMethod: ExpiryMethod;
  id: string;
  issuer: string | null;
  mimeType: string;
  originalFilename: string;
  referenceYear: number | null;
  remainingDays: number | null;
  remainingDaysMessage: string;
  signedAttested: boolean;
  sizeBytes: number;
  status: DocumentStatus;
  statusLabel: string;
  supersedesDocumentId: string | null;
  updatedAt: string;
  validFrom: string;
};

export const DOCUMENT_SELECT =
  "id, owner_id, document_type_id, display_name, original_filename, storage_path, mime_type, size_bytes, valid_from, expiry_method, duration_months, expires_on, reference_year, signed_attested, issuer, description, supersedes_document_id, deleted_at, created_at, updated_at, document_types(label)";

function relationLabel(
  relation: DocumentRow["document_types"],
  fallback: string,
): string {
  if (Array.isArray(relation)) {
    return relation[0]?.label ?? fallback;
  }

  return relation?.label ?? fallback;
}

export function toDocumentSummary(
  row: DocumentRow,
  today: string,
): DocumentSummary {
  const result = calculateDocumentStatus(row.expires_on, 21, today);

  return {
    createdAt: row.created_at,
    description: row.description,
    displayName: row.display_name,
    documentTypeId: row.document_type_id,
    documentTypeLabel: relationLabel(row.document_types, row.document_type_id),
    durationMonths: row.duration_months,
    expiresOn: row.expires_on,
    expiryMethod: row.expiry_method,
    id: row.id,
    issuer: row.issuer,
    mimeType: row.mime_type,
    originalFilename: row.original_filename,
    referenceYear: row.reference_year,
    remainingDays: result.remainingDays,
    remainingDaysMessage: getRemainingDaysMessage(result),
    signedAttested: row.signed_attested,
    sizeBytes: row.size_bytes,
    status: result.status,
    statusLabel: getStatusLabel(result.status),
    supersedesDocumentId: row.supersedes_document_id,
    updatedAt: row.updated_at,
    validFrom: row.valid_from,
  };
}

export async function getDocumentTypeRules(
  supabase: SupabaseClient,
  documentTypeId: string,
): Promise<DocumentTypeRules | undefined> {
  const { data } = await supabase
    .from("document_types")
    .select(
      "id, label, default_expiry_method, default_duration_months, requires_year, allows_signed_attestation",
    )
    .eq("id", documentTypeId)
    .single();

  if (!data) {
    return undefined;
  }

  return {
    allowsSignedAttestation: data.allows_signed_attestation,
    defaultDurationMonths: data.default_duration_months,
    defaultExpiryMethod: data.default_expiry_method,
    id: data.id,
    label: data.label,
    requiresYear: data.requires_year,
  };
}

export async function getOwnedDocument(
  supabase: SupabaseClient,
  documentId: string,
  ownerId: string,
): Promise<DocumentRow | null> {
  const { data } = await supabase
    .from("documents")
    .select(DOCUMENT_SELECT)
    .eq("id", documentId)
    .eq("owner_id", ownerId)
    .is("deleted_at", null)
    .maybeSingle();

  return (data as unknown as DocumentRow | null) ?? null;
}

export function documentFormStrings(formData: FormData): Record<string, string> {
  const names = [
    "description",
    "displayName",
    "documentTypeId",
    "durationMonths",
    "expiresOn",
    "expiryMethod",
    "issuer",
    "referenceYear",
    "signedAttested",
    "validFrom",
  ];

  return Object.fromEntries(
    names.map((name) => {
      const value = formData.get(name);
      return [name, typeof value === "string" ? value : ""];
    }),
  );
}

export function documentInsertValues(
  documentId: string,
  ownerId: string,
  storagePath: string,
  originalFilename: string,
  mimeType: string,
  sizeBytes: number,
  metadata: {
    description: string | null;
    displayName: string;
    documentTypeId: string;
    durationMonths: number | null;
    expiresOn: string | null;
    expiryMethod: ExpiryMethod;
    issuer: string | null;
    referenceYear: number | null;
    signedAttested: boolean;
    validFrom: string;
  },
  supersedesDocumentId: string | null = null,
) {
  return {
    description: metadata.description,
    display_name: metadata.displayName,
    document_type_id: metadata.documentTypeId,
    duration_months: metadata.durationMonths,
    expires_on: metadata.expiresOn,
    expiry_method: metadata.expiryMethod,
    id: documentId,
    issuer: metadata.issuer,
    mime_type: mimeType,
    original_filename: originalFilename,
    owner_id: ownerId,
    reference_year: metadata.referenceYear,
    signed_attested: metadata.signedAttested,
    size_bytes: sizeBytes,
    storage_path: storagePath,
    supersedes_document_id: supersedesDocumentId,
    valid_from: metadata.validFrom,
  };
}
