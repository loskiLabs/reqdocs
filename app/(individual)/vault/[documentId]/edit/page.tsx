import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  DocumentForm,
  type InitialDocumentValues,
} from "@/components/documents/document-form";
import { requireRole } from "@/lib/auth/require-role";
import { getOwnedDocument } from "@/lib/documents/server";
import { listDocumentTypes } from "@/lib/documents/vault-data";
import { getJohannesburgToday } from "@/lib/documents/validity";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Replace document | ReqDocs",
};

export default async function ReplaceDocumentPage({
  params,
  searchParams,
}: {
  params: Promise<{ documentId: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const profile = await requireRole("individual");
  const supabase = await createClient();
  const { documentId } = await params;
  const query = await searchParams;
  const returnTo = /^\/packs\/[0-9a-f-]{36}$/.test(query.returnTo ?? "")
    ? query.returnTo
    : undefined;
  const [document, documentTypes] = await Promise.all([
    getOwnedDocument(supabase, documentId, profile.id),
    listDocumentTypes(supabase),
  ]);

  if (!document) notFound();

  const initialDocument: InitialDocumentValues = {
    description: document.description ?? "",
    displayName: document.display_name,
    documentTypeId: document.document_type_id,
    durationMonths: document.duration_months ?? "",
    expiresOn: document.expires_on ?? "",
    expiryMethod: document.expiry_method,
    id: document.id,
    issuer: document.issuer ?? "",
    referenceYear: document.reference_year ?? "",
    signedAttested: document.signed_attested,
    validFrom: document.valid_from,
  };

  return (
    <main className="mx-auto max-w-4xl px-5 py-10 sm:px-8 sm:py-14">
      <Link
        className="inline-flex min-h-11 items-center font-bold text-[var(--primary)] underline underline-offset-4"
        href={returnTo ?? "/vault"}
      >
        {returnTo ? "Back to Service Pack" : "Back to Document Vault"}
      </Link>
      <p className="mt-6 text-sm font-bold uppercase tracking-[0.15em] text-[var(--primary)]">
        Document Vault
      </p>
      <h1 className="mt-3 text-3xl font-bold tracking-[-0.025em] sm:text-4xl">
        Replace {document.display_name}
      </h1>
      <p className="mt-3 max-w-2xl leading-7 text-[var(--muted)]">
        The replacement becomes the active Vault document. The previous record is
        retained as soft-deleted history and is no longer listed.
      </p>
      <div className="mt-8">
        <DocumentForm
          documentTypes={documentTypes}
          initialDocument={initialDocument}
          mode="replace"
          returnTo={returnTo}
          today={getJohannesburgToday()}
        />
      </div>
    </main>
  );
}
