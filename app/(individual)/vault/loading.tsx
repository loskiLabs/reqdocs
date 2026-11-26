export default function VaultLoading() {
  return (
    <main
      aria-busy="true"
      className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14"
    >
      <h1 className="text-3xl font-bold">Document Vault</h1>
      <p className="mt-4 text-[var(--muted)]">Loading your private documents…</p>
    </main>
  );
}
