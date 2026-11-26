"use client";

export default function VaultError({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto max-w-4xl px-5 py-10 sm:px-8 sm:py-14">
      <h1 className="text-3xl font-bold">Document Vault unavailable</h1>
      <p className="mt-4 max-w-xl leading-7 text-[var(--muted)]">
        We could not load your private documents. Your files have not been changed.
      </p>
      <button
        className="mt-6 min-h-12 bg-[var(--primary)] px-5 font-bold text-white"
        onClick={() => reset()}
        type="button"
      >
        Try again
      </button>
    </main>
  );
}
