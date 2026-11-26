"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeleteDocumentButton({
  displayName,
  documentId,
}: {
  displayName: string;
  documentId: string;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function removeDocument() {
    if (!window.confirm(`Remove ${displayName} from your Document Vault?`)) {
      return;
    }

    setPending(true);
    setError("");

    try {
      const response = await fetch(`/api/documents/${documentId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const body = (await response.json()) as {
          error?: { message?: string };
        };
        setError(body.error?.message ?? "We could not remove this document.");
        return;
      }

      router.refresh();
    } catch {
      setError("We could not remove this document. Check your connection.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <button
        className="min-h-11 px-3 text-sm font-bold text-red-700 underline decoration-red-300 underline-offset-4 hover:decoration-red-700 disabled:opacity-60"
        disabled={pending}
        onClick={removeDocument}
        type="button"
      >
        {pending ? "Removing…" : "Delete"}
      </button>
      {error ? (
        <p aria-live="polite" className="mt-2 max-w-56 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
