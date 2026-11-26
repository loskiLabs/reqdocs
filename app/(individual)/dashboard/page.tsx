import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth/require-role";
import { listVaultDocuments } from "@/lib/documents/vault-data";
import { getJohannesburgToday } from "@/lib/documents/validity";
import { createClient } from "@/lib/supabase/server";
import { listOwnedPacks } from "@/lib/packs/server";
import { listAccessHistory } from "@/lib/history/server";

export const metadata: Metadata = {
  title: "Dashboard | ReqDocs",
};

export default async function DashboardPage() {
  const profile = await requireRole("individual");
  const supabase = await createClient();
  const [documents, packs, history] = await Promise.all([
    listVaultDocuments(supabase, profile.id, getJohannesburgToday()),
    listOwnedPacks(supabase, profile.id),
    listAccessHistory(profile.id),
  ]);
  const activePacks = packs.filter(
    (pack) => pack.status !== "cancelled" && pack.status !== "documents_received",
  );
  const expired = documents.filter((document) => document.status === "expired");
  const expiringSoon = documents.filter(
    (document) => document.status === "expiring_soon",
  );

  return (
    <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
      <p className="text-sm font-bold uppercase tracking-[0.15em] text-[var(--primary)]">
        Individual workspace
      </p>
      <h1 className="mt-3 text-3xl font-bold tracking-[-0.025em] sm:text-4xl">
        Welcome, {profile.displayName}
      </h1>
      <section
        aria-labelledby="vault-health"
        className="mt-8"
      >
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h2 className="text-2xl font-bold" id="vault-health">
              Document health
            </h2>
            <p className="mt-2 text-[var(--muted)]">
              Status is calculated from the dates you recorded.
            </p>
          </div>
          <Link
            className="flex min-h-12 items-center justify-center bg-[var(--primary)] px-5 font-bold text-white hover:bg-[var(--primary-hover)]"
            href={documents.length === 0 ? "/vault/new" : "/vault"}
          >
            {documents.length === 0 ? "Add your first document" : "Open Document Vault"}
          </Link>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <article className="border border-[var(--border)] bg-white p-5">
            <p className="text-sm font-bold text-[var(--muted)]">Total documents</p>
            <p className="mt-2 text-3xl font-bold">{documents.length}</p>
          </article>
          <article className="border border-red-200 bg-white p-5">
            <p className="text-sm font-bold text-red-800">Expired</p>
            <p className="mt-2 text-3xl font-bold">{expired.length}</p>
          </article>
          <article className="border border-amber-300 bg-white p-5">
            <p className="text-sm font-bold text-amber-900">Expiring soon</p>
            <p className="mt-2 text-3xl font-bold">{expiringSoon.length}</p>
          </article>
        </div>
      </section>

      <section aria-labelledby="recent-access" className="mt-10">
        <div className="flex items-end justify-between gap-4"><h2 className="text-2xl font-bold" id="recent-access">Recent access events</h2><Link className="inline-flex min-h-11 items-center font-bold text-[var(--primary)] underline" href="/history">View all</Link></div>
        {history.length ? <ol className="mt-4 divide-y divide-[var(--border)] border border-[var(--border)] bg-white">{history.slice(0, 3).map((event) => <li className="p-5" key={event.id}><p className="font-bold">{event.action}</p><p className="mt-1 text-sm text-[var(--muted)]">{event.serviceName} · {new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Johannesburg" }).format(new Date(event.createdAt))}</p></li>)}</ol> : <p className="mt-4 border border-[var(--border)] bg-white p-5 text-[var(--muted)]">No sharing or staff-access events yet.</p>}
      </section>

      <section aria-labelledby="active-service-packs" className="mt-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div><h2 className="text-2xl font-bold" id="active-service-packs">Active Service Packs</h2><p className="mt-2 text-[var(--muted)]">Your next action for each service.</p></div>
          <Link className="flex min-h-12 items-center justify-center bg-[var(--primary)] px-5 font-bold text-white" href="/packs/new">Prepare for a Service</Link>
        </div>
        {activePacks.length ? <div className="mt-5 grid gap-4 md:grid-cols-2">{activePacks.map((pack) => <article className="border border-[var(--border)] bg-white p-5" key={pack.id}><p className="text-sm font-bold text-[var(--primary)]">{pack.service.organization.shortName}</p><h3 className="mt-2 text-lg font-bold"><Link className="underline underline-offset-4" href={`/packs/${pack.id}`}>{pack.service.name}</Link></h3><p className="mt-3 font-bold">{pack.readinessPercent}% ready</p><p className="mt-2 text-sm leading-6 text-[var(--muted)]">{pack.nextAction}</p></article>)}</div> : <div className="mt-5 border border-[var(--border)] bg-white p-5"><p className="text-[var(--muted)]">No active packs yet. Choose one of the two supported services to begin.</p></div>}
      </section>

      {documents.length === 0 ? (
        <section
          aria-labelledby="empty-vault"
          className="mt-8 max-w-2xl border border-[var(--border)] bg-white p-6 sm:p-8"
        >
          <h2 className="text-xl font-bold" id="empty-vault">
            Prepare once, reuse later
          </h2>
          <p className="mt-3 leading-7 text-[var(--muted)]">
            Add a fictional document to your private Vault. ReqDocs will use its
            recorded dates when you prepare a Service Pack.
          </p>
        </section>
      ) : (
        <section
          aria-labelledby="dashboard-next-action"
          className="mt-8 max-w-2xl border-l-4 border-[var(--primary)] bg-blue-50 p-6"
        >
          <h2 className="text-xl font-bold" id="dashboard-next-action">
            Your Vault is ready for Service Packs
          </h2>
          <p className="mt-2 leading-7 text-[var(--muted)]">
            Review expired or expiring documents, then prepare a Service Pack for
            one of the two supported services.
          </p>
        </section>
      )}
    </main>
  );
}
