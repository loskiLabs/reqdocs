import type { Metadata } from "next";
import Link from "next/link";
import { DocumentForm } from "@/components/documents/document-form";
import { requireRole } from "@/lib/auth/require-role";
import { listDocumentTypes } from "@/lib/documents/vault-data";
import { getJohannesburgToday } from "@/lib/documents/validity";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Add document | ReqDocs",
};

export default async function NewDocumentPage({
  searchParams,
}: {
  searchParams: Promise<{ documentType?: string; returnTo?: string }>;
}) {
  await requireRole("individual");
  const documentTypes = await listDocumentTypes(await createClient());
  const query = await searchParams;
  const returnTo = /^\/packs\/[0-9a-f-]{36}$/.test(query.returnTo ?? "")
    ? query.returnTo
    : undefined;

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
        Add a document
      </h1>
      <p className="mt-3 max-w-2xl leading-7 text-[var(--muted)]">
        Enter only fictional demo information. Your file will be stored privately,
        and its dates determine the displayed status.
      </p>
      <div className="mt-8">
        <DocumentForm
          documentTypes={documentTypes}
          initialDocumentTypeId={query.documentType}
          mode="create"
          returnTo={returnTo}
          today={getJohannesburgToday()}
        />
      </div>
    </main>
  );
}
