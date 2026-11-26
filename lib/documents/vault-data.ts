import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DOCUMENT_SELECT,
  toDocumentSummary,
  type DocumentRow,
  type DocumentSummary,
} from "./server";
import type { DocumentStatus } from "./validity";
import type { DocumentTypeRules } from "./upload-validation";

export type VaultFilters = {
  documentType?: string;
  status?: DocumentStatus;
};

export async function listVaultDocuments(
  supabase: SupabaseClient,
  ownerId: string,
  today: string,
  filters: VaultFilters = {},
): Promise<DocumentSummary[]> {
  let query = supabase
    .from("documents")
    .select(DOCUMENT_SELECT)
    .eq("owner_id", ownerId)
    .is("deleted_at", null)
    .order("valid_from", { ascending: false })
    .order("created_at", { ascending: false });

  if (filters.documentType) {
    query = query.eq("document_type_id", filters.documentType);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error("Unable to load Vault documents.");
  }

  return ((data ?? []) as unknown as DocumentRow[])
    .map((row) => toDocumentSummary(row, today))
    .filter((document) => !filters.status || document.status === filters.status);
}

export async function listDocumentTypes(
  supabase: SupabaseClient,
): Promise<DocumentTypeRules[]> {
  const { data, error } = await supabase
    .from("document_types")
    .select(
      "id, label, default_expiry_method, default_duration_months, requires_year, allows_signed_attestation",
    )
    .order("label");

  if (error) {
    throw new Error("Unable to load document types.");
  }

  return (data ?? []).map((row) => ({
    allowsSignedAttestation: row.allows_signed_attestation,
    defaultDurationMonths: row.default_duration_months,
    defaultExpiryMethod: row.default_expiry_method,
    id: row.id,
    label: row.label,
    requiresYear: row.requires_year,
  }));
}
