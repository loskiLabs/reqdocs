import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Privacy | ReqDocs" };

export default function PrivacyPage() {
  return <main className="mx-auto max-w-3xl px-5 py-12 sm:px-8 sm:py-16">
    <Link className="inline-flex min-h-11 items-center font-bold text-[var(--primary)] underline" href="/">Back to ReqDocs</Link>
    <h1 className="mt-6 text-3xl font-bold sm:text-4xl">Privacy and demo-data notice</h1>
    <p className="mt-4 leading-7">ReqDocs is a hackathon MVP. Use fictional documents only. Never upload a real identity document, bank letter, proof of address, student number or signature.</p>
    <section className="mt-8"><h2 className="text-xl font-bold">Limited sharing</h2><p className="mt-2 leading-7 text-[var(--muted)]">Personal files remain in a private Storage bucket. Staff can open only the documents in one consented Service Pack, after redeeming a single-use code, for a maximum of 15 minutes.</p></section>
    <section className="mt-8"><h2 className="text-xl font-bold">Deletion</h2><p className="mt-2 leading-7 text-[var(--muted)]">Vault deletion hides document metadata immediately unless temporary staff access is active. A production version must also provide complete account and private-file deletion, retention periods, and a documented support process before accepting real personal data.</p></section>
    <section className="mt-8"><h2 className="text-xl font-bold">Honest limits</h2><p className="mt-2 leading-7 text-[var(--muted)]">ReqDocs checks dates and information entered by the user. It does not inspect authenticity, guarantee acceptance, submit an application, or record final approval.</p></section>
  </main>;
}
