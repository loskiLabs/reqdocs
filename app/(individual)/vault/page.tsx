import type { Metadata } from "next";
import Link from "next/link";
import { DeleteDocumentButton } from "@/components/documents/delete-document-button";
import { DocumentStatus } from "@/components/documents/document-status";
import { requireRole } from "@/lib/auth/require-role";
import { listDocumentTypes, listVaultDocuments } from "@/lib/documents/vault-data";
import {
  getJohannesburgToday,
  type DocumentStatus as Status,
} from "@/lib/documents/validity";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Document Vault | ReqDocs",
};

const statusOptions: { label: string; value: Status }[] = [
  { label: "Current", value: "current" },
  { label: "Expiring soon", value: "expiring_soon" },
  { label: "Expired", value: "expired" },
  { label: "No expiry recorded", value: "no_expiry" },
];

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-ZA", {
    day: "numeric",
    month: "short",
    timeZone: "Africa/Johannesburg",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00+02:00`));
}

export default async function VaultPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await requireRole("individual");
  const supabase = await createClient();
  const params = await searchParams;
  const requestedStatus =
    typeof params.status === "string" &&
    statusOptions.some((option) => option.value === params.status)
      ? (params.status as Status)
      : undefined;
  const requestedType =
    typeof params.documentType === "string" ? params.documentType : undefined;
  const [documentTypes, allDocuments] = await Promise.all([
    listDocumentTypes(supabase),
    listVaultDocuments(supabase, profile.id, getJohannesburgToday()),
  ]);
  const documents = allDocuments.filter(
    (document) =>
      (!requestedStatus || document.status === requestedStatus) &&
      (!requestedType || document.documentTypeId === requestedType),
  );
  const notice =
    params.added === "1"
      ? "Document saved privately in your Vault."
      : params.replaced === "1"
        ? "Replacement saved. The previous document is no longer active."
        : null;

  return (
    <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
      {notice ? (
        <p
          aria-live="polite"
          className="mb-6 border-l-4 border-green-700 bg-green-50 p-4 font-bold text-green-900"
        >
          {notice}
        </p>
      ) : null}
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.15em] text-[var(--primary)]">
            Private workspace
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-[-0.025em] sm:text-4xl">
            Document Vault
          </h1>
          <p className="mt-3 max-w-2xl leading-7 text-[var(--muted)]">
            Store fictional demo documents privately and track their status from
            the dates you provide. Files are not made public.
          </p>
        </div>
        <Link
          className="flex min-h-12 items-center justify-center bg-[var(--primary)] px-5 font-bold text-white hover:bg-[var(--primary-hover)]"
          href="/vault/new"
        >
          Add document
        </Link>
      </div>

      {allDocuments.length > 0 ? (
        <form
          aria-label="Filter Vault documents"
          className="mt-8 grid gap-4 border border-[var(--border)] bg-white p-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        >
          <label className="font-bold" htmlFor="status">
            Status
            <select
              className="mt-2 min-h-12 w-full border border-slate-400 bg-white px-3"
              defaultValue={requestedStatus ?? ""}
              id="status"
              name="status"
            >
              <option value="">All statuses</option>
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="font-bold" htmlFor="documentType">
            Document type
            <select
              className="mt-2 min-h-12 w-full border border-slate-400 bg-white px-3"
              defaultValue={requestedType ?? ""}
              id="documentType"
              name="documentType"
            >
              <option value="">All document types</option>
              {documentTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.label}
                </option>
              ))}
            </select>
          </label>
          <button
            className="min-h-12 border border-[var(--primary)] px-5 font-bold text-[var(--primary)] hover:bg-blue-50"
            type="submit"
          >
            Apply filters
          </button>
        </form>
      ) : null}

      {allDocuments.length === 0 ? (
        <section
          aria-labelledby="vault-empty-heading"
          className="mt-8 border border-[var(--border)] bg-white p-6 sm:p-8"
        >
          <h2 className="text-xl font-bold" id="vault-empty-heading">
            Your Vault is empty
          </h2>
          <p className="mt-3 max-w-2xl leading-7 text-[var(--muted)]">
            Add your first fictional document to preview calendar-month validity
            and prepare it for reuse in a Service Pack.
          </p>
          <Link
            className="mt-5 inline-flex min-h-12 items-center justify-center bg-[var(--primary)] px-5 font-bold text-white"
            href="/vault/new"
          >
            Add your first document
          </Link>
        </section>
      ) : documents.length === 0 ? (
        <section className="mt-8 border border-[var(--border)] bg-white p-6">
          <h2 className="text-xl font-bold">No documents match these filters</h2>
          <Link
            className="mt-4 inline-flex min-h-11 items-center font-bold text-[var(--primary)] underline"
            href="/vault"
          >
            Clear filters
          </Link>
        </section>
      ) : (
        <section aria-labelledby="vault-list-heading" className="mt-8">
          <h2 className="sr-only" id="vault-list-heading">
            Your documents
          </h2>
          <div className="grid gap-5 lg:grid-cols-2">
            {documents.map((document) => (
              <article
                className="border border-[var(--border)] bg-white p-5 sm:p-6"
                key={document.id}
              >
                <div className="flex flex-col items-start justify-between gap-3 sm:flex-row">
                  <div>
                    <p className="text-sm font-bold text-[var(--primary)]">
                      {document.documentTypeLabel}
                    </p>
                    <h3 className="mt-1 text-xl font-bold">{document.displayName}</h3>
                  </div>
                  <DocumentStatus
                    label={document.statusLabel}
                    status={document.status}
                  />
                </div>
                <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 text-sm">
                  <dt className="font-bold">Document date</dt>
                  <dd>{formatDate(document.validFrom)}</dd>
                  <dt className="font-bold">Expiry</dt>
                  <dd>
                    {document.expiresOn
                      ? formatDate(document.expiresOn)
                      : "No expiry recorded"}
                  </dd>
                  <dt className="font-bold">Status detail</dt>
                  <dd>{document.remainingDaysMessage}</dd>
                  {document.referenceYear ? (
                    <>
                      <dt className="font-bold">Reference year</dt>
                      <dd>{document.referenceYear}</dd>
                    </>
                  ) : null}
                  <dt className="font-bold">File</dt>
                  <dd className="break-all">{document.originalFilename}</dd>
                </dl>
                <div className="mt-5 flex flex-wrap items-start gap-2 border-t border-[var(--border)] pt-4">
                  <a
                    className="inline-flex min-h-11 items-center px-3 text-sm font-bold text-[var(--primary)] underline underline-offset-4"
                    href={`/api/documents/${document.id}/preview`}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Preview
                  </a>
                  <Link
                    className="inline-flex min-h-11 items-center px-3 text-sm font-bold text-[var(--primary)] underline underline-offset-4"
                    href={`/vault/${document.id}/edit`}
                  >
                    Replace
                  </Link>
                  <DeleteDocumentButton
                    displayName={document.displayName}
                    documentId={document.id}
                  />
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
