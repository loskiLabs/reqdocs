import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-5 py-16">
      <p className="font-bold text-[var(--primary)]">404</p>
      <h1 className="mt-2 text-3xl font-bold">We could not find that page</h1>
      <p className="mt-4 leading-7 text-[var(--muted)]">
        Check the address or return to the ReqDocs home page.
      </p>
      <Link
        className="mt-8 inline-flex min-h-12 w-fit items-center bg-[var(--primary)] px-5 font-bold text-white"
        href="/"
      >
        Go to home page
      </Link>
    </main>
  );
}
