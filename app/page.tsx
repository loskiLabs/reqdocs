import Link from "next/link";

const benefits = [
  {
    number: "01",
    title: "Keep documents private",
    description:
      "Store reusable documents in your personal Vault with clear date and expiry details.",
  },
  {
    number: "02",
    title: "Know what needs attention",
    description:
      "See every requirement, what is current, and the next document you need to prepare.",
  },
  {
    number: "03",
    title: "Share one pack only",
    description:
      "Give authorised staff short-lived access to the exact Service Pack you choose.",
  },
];

function DocumentMark() {
  return (
    <svg
      aria-hidden="true"
      className="h-7 w-7"
      fill="none"
      viewBox="0 0 28 28"
    >
      <path
        d="M7 3.5h9l5 5V24.5H7v-21Z"
        fill="currentColor"
        opacity=".12"
      />
      <path
        d="M16 3.5v5h5M7 3.5h9l5 5V24.5H7v-21Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="m10.5 16 2.2 2.2 4.8-5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <Link
            className="flex min-h-11 items-center gap-2 text-lg font-bold tracking-tight text-[var(--foreground)]"
            href="/"
          >
            <span className="text-[var(--primary)]">
              <DocumentMark />
            </span>
            ReqDocs
          </Link>
          <Link
            className="flex min-h-11 items-center px-2 text-sm font-semibold text-[var(--primary)] underline-offset-4 hover:underline"
            href="/staff/login"
          >
            Staff sign in
          </Link>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl gap-12 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[1.08fr_.92fr] lg:items-center lg:py-32">
          <div>
            <p className="mb-5 text-sm font-bold uppercase tracking-[0.16em] text-[var(--primary)]">
              Your documents, ready when you are
            </p>
            <h1 className="max-w-3xl text-4xl font-bold leading-[1.08] tracking-[-0.035em] sm:text-6xl">
              Arrive ready the first time.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--muted)]">
              ReqDocs helps you collect the right, current documents before a
              service visit—and share only the pack that staff need to review.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                className="inline-flex min-h-12 items-center justify-center bg-[var(--primary)] px-6 py-3 text-base font-bold text-white hover:bg-[var(--primary-hover)]"
                href="/register"
              >
                Create account
              </Link>
              <Link
                className="inline-flex min-h-12 items-center justify-center border border-[var(--border)] bg-white px-6 py-3 text-base font-bold text-[var(--foreground)] hover:border-slate-400"
                href="/login"
              >
                Sign in
              </Link>
            </div>
          </div>

          <div
            aria-label="Example Service Pack readiness"
            className="border border-[var(--border)] bg-white p-6 shadow-[0_18px_50px_rgba(22,40,76,0.08)] sm:p-8"
          >
            <div className="flex items-start justify-between gap-6 border-b border-[var(--border)] pb-6">
              <div>
                <p className="text-sm font-semibold text-[var(--muted)]">
                  Service Pack
                </p>
                <h2 className="mt-1 text-xl font-bold">
                  External bursary allowance
                </h2>
              </div>
              <span className="bg-blue-50 px-3 py-1 text-sm font-bold text-blue-800">
                80%
              </span>
            </div>
            <div className="py-6">
              <div className="mb-3 flex items-center justify-between text-sm">
                <span className="font-semibold">4 of 5 documents ready</span>
                <span className="text-[var(--muted)]">One action left</span>
              </div>
              <div
                aria-label="80 percent ready"
                aria-valuemax={100}
                aria-valuemin={0}
                aria-valuenow={80}
                className="h-2.5 overflow-hidden bg-slate-200"
                role="progressbar"
              >
                <div className="h-full w-4/5 bg-[var(--primary)]" />
              </div>
            </div>
            <div className="border-l-4 border-amber-500 bg-amber-50 p-4">
              <p className="font-bold text-amber-950">Action needed</p>
              <p className="mt-1 text-sm leading-6 text-amber-950">
                Upload your completed and signed allowance form.
              </p>
            </div>
          </div>
        </section>

        <section
          aria-labelledby="how-it-works"
          className="border-y border-[var(--border)] bg-white"
        >
          <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-20">
            <h2 id="how-it-works" className="text-2xl font-bold sm:text-3xl">
              Prepare with confidence
            </h2>
            <div className="mt-9 grid gap-px overflow-hidden border border-[var(--border)] bg-[var(--border)] md:grid-cols-3">
              {benefits.map((benefit) => (
                <article className="bg-white p-6 sm:p-8" key={benefit.number}>
                  <p className="text-sm font-bold text-[var(--primary)]">
                    {benefit.number}
                  </p>
                  <h3 className="mt-4 text-lg font-bold">{benefit.title}</h3>
                  <p className="mt-3 leading-7 text-[var(--muted)]">
                    {benefit.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-8 text-sm text-[var(--muted)] sm:px-8">
        <p>
          ReqDocs checks completeness and dates. Service staff make the final
          decision.
        </p>
        <p>
          Demo notice: use fictional documents only. Never upload real identity
          or banking information.
        </p>
        <Link className="inline-flex min-h-11 items-center font-bold text-[var(--primary)] underline" href="/privacy">Privacy and deletion notice</Link>
      </footer>
    </div>
  );
}
