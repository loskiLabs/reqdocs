import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth/require-role";
import { listOwnedPacks } from "@/lib/packs/server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Service Packs | ReqDocs" };

const statusLabels: Record<string, string> = {
  cancelled: "Cancelled",
  code_active: "Access code active",
  documents_received: "Documents received for processing",
  draft: "In progress",
  needs_changes: "Changes requested",
  ready: "Ready for staff review",
  viewed: "Viewed by staff",
};

export default async function PacksPage({ searchParams }: { searchParams: Promise<{ cancelled?: string }> }) {
  const profile = await requireRole("individual");
  const packs = await listOwnedPacks(await createClient(), profile.id);
  const active = packs.filter((pack) => pack.status !== "cancelled" && pack.status !== "documents_received");
  const complete = packs.filter((pack) => !active.includes(pack));
  const cancelled = (await searchParams).cancelled === "1";

  return (
    <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.15em] text-[var(--primary)]">Individual workspace</p>
          <h1 className="mt-3 text-3xl font-bold sm:text-4xl">Service Packs</h1>
          <p className="mt-3 max-w-2xl leading-7 text-[var(--muted)]">See what each service needs and reuse current documents from your private Vault.</p>
        </div>
        <Link className="flex min-h-12 items-center justify-center bg-[var(--primary)] px-5 font-bold text-white" href="/packs/new">Prepare for a Service</Link>
      </div>
      {cancelled ? <p className="mt-6 border-l-4 border-emerald-700 bg-emerald-50 p-4 font-bold text-emerald-900" role="status">Service Pack cancelled.</p> : null}
      <section aria-labelledby="active-packs" className="mt-9">
        <h2 className="text-2xl font-bold" id="active-packs">Active packs</h2>
        {active.length === 0 ? (
          <div className="mt-4 border border-[var(--border)] bg-white p-6"><p className="text-[var(--muted)]">You have no active Service Packs.</p></div>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {active.map((pack) => <PackCard key={pack.id} pack={pack} />)}
          </div>
        )}
      </section>
      {complete.length ? <section aria-labelledby="past-packs" className="mt-10"><h2 className="text-2xl font-bold" id="past-packs">Past packs</h2><div className="mt-4 grid gap-4 md:grid-cols-2">{complete.map((pack) => <PackCard key={pack.id} pack={pack} />)}</div></section> : null}
    </main>
  );
}

function PackCard({ pack }: { pack: Awaited<ReturnType<typeof listOwnedPacks>>[number] }) {
  return <article className="border border-[var(--border)] bg-white p-6">
    <p className="text-sm font-bold text-[var(--primary)]">{pack.service.organization.shortName}</p>
    <h3 className="mt-2 text-xl font-bold"><Link className="underline decoration-2 underline-offset-4" href={`/packs/${pack.id}`}>{pack.service.name}</Link></h3>
    <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-label={`${pack.service.name} readiness`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pack.readinessPercent}><div className="h-full bg-[var(--primary)]" style={{ width: `${pack.readinessPercent}%` }} /></div>
    <p className="mt-2 font-bold">{pack.readinessPercent}% ready · {statusLabels[pack.status]}</p>
    <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{pack.nextAction}</p>
  </article>;
}
