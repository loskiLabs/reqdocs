import Link from "next/link";

type AuthShellProps = {
  children: React.ReactNode;
  description: string;
  eyebrow?: string;
  title: string;
};

export function AuthShell({
  children,
  description,
  eyebrow,
  title,
}: AuthShellProps) {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="border-b border-[var(--border)] bg-white">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center px-5 sm:px-8">
          <Link
            className="flex min-h-11 items-center text-lg font-bold tracking-tight"
            href="/"
          >
            <span aria-hidden="true" className="mr-2 text-[var(--primary)]">
              ✓
            </span>
            ReqDocs
          </Link>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-10 px-5 py-12 sm:px-8 sm:py-20 lg:grid-cols-[minmax(0,1fr)_28rem] lg:items-start">
        <section className="max-w-xl pt-2 lg:pt-12">
          {eyebrow ? (
            <p className="text-sm font-bold uppercase tracking-[0.15em] text-[var(--primary)]">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="mt-3 text-3xl font-bold tracking-[-0.025em] sm:text-5xl">
            {title}
          </h1>
          <p className="mt-5 text-lg leading-8 text-[var(--muted)]">{description}</p>
          <div className="mt-8 border-l-4 border-blue-600 bg-blue-50 p-4 text-sm leading-6 text-blue-950">
            <p className="font-bold">Use fictional information for this demo.</p>
            <p className="mt-1">
              Never upload real identity, banking, address or signature documents.
            </p>
          </div>
        </section>

        <section className="border border-[var(--border)] bg-white p-5 shadow-[0_18px_50px_rgba(22,40,76,0.08)] sm:p-8">
          {children}
        </section>
      </main>
    </div>
  );
}
