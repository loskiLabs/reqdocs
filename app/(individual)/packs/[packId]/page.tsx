import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CancelPackButton } from "@/components/packs/cancel-pack-button";
import { ShareAccessCode } from "@/components/packs/share-access-code";
import { requireRole } from "@/lib/auth/require-role";
import { getOwnedPack } from "@/lib/packs/server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Service Pack | ReqDocs" };

const resultLabels: Record<string, string> = { current: "Current", expired: "Expired", expiring_soon: "Expiring soon", missing: "Missing", no_expiry: "Current — no expiry recorded", unsigned: "Signature confirmation needed", wrong_year: "Wrong year" };

export default async function PackPage({ params }: { params: Promise<{ packId: string }> }) {
  const profile = await requireRole("individual");
  const { packId } = await params;
  const pack = await getOwnedPack(await createClient(), packId, profile.id);
  if (!pack) notFound();
  const returnTo = encodeURIComponent(`/packs/${pack.id}`);
  const canEdit = !["cancelled", "documents_received", "viewed"].includes(pack.status);

  return <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
    <Link className="inline-flex min-h-11 items-center font-bold text-[var(--primary)] underline underline-offset-4" href="/packs">Back to Service Packs</Link>
    <div className="mt-6 grid gap-7 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
      <div>
        <p className="text-sm font-bold uppercase tracking-[0.15em] text-[var(--primary)]">{pack.service.organization.shortName}</p>
        <h1 className="mt-3 text-3xl font-bold sm:text-4xl">{pack.service.name}</h1>
        <div className="mt-6 h-4 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-label="Service Pack readiness" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pack.readinessPercent}><div className="h-full bg-[var(--primary)]" style={{ width: `${pack.readinessPercent}%` }} /></div>
        <p className="mt-3 text-xl font-bold">{pack.readinessPercent}% ready</p>
        <p className="mt-2 leading-7 text-[var(--muted)]">{pack.nextAction}</p>
        {pack.staffFeedback ? <section className="mt-5 border-l-4 border-amber-600 bg-amber-50 p-5"><h2 className="font-bold">Staff requested changes</h2><p className="mt-2">{pack.staffFeedback}</p></section> : null}
      </div>
      <aside className="border border-[var(--border)] bg-white p-5">
        <h2 className="font-bold">Where to take it</h2><p className="mt-2 text-sm leading-6 text-[var(--muted)]">{pack.service.destinationText}</p>
        {pack.service.blankFormPath ? <a className="mt-5 inline-flex min-h-11 items-center font-bold text-[var(--primary)] underline underline-offset-4" download href={pack.service.blankFormPath}>Download {pack.service.id.startsWith("uj_") ? "2026 allowance form" : "vehicle licence renewal form"}</a> : null}
      </aside>
    </div>
    <section aria-labelledby="requirements-heading" className="mt-10"><h2 className="text-2xl font-bold" id="requirements-heading">Required documents</h2><ol className="mt-5 space-y-4">{pack.items.map((item) => <li className={`border-l-4 bg-white p-5 sm:p-6 ${item.satisfied ? item.result === "expiring_soon" ? "border-amber-500" : "border-emerald-600" : "border-red-700"}`} key={item.id}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-sm font-bold text-[var(--muted)]">Requirement {item.sortOrder}</p><h3 className="mt-1 text-lg font-bold">{item.label}</h3></div><span className="w-fit border border-current px-3 py-1 text-sm font-bold">{resultLabels[item.result]}</span></div>
      <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{item.reason}</p>
      <p className="mt-2 text-sm">{item.helpText}</p>
      {item.document ? <div className="mt-4 bg-slate-50 p-4"><p className="font-bold">Using: {item.document.displayName}</p><p className="mt-1 break-all text-sm text-[var(--muted)]">{item.document.originalFilename} · valid from {item.document.validFrom}</p><div className="mt-3 flex flex-wrap gap-4"><a className="inline-flex min-h-11 items-center font-bold text-[var(--primary)] underline" href={`/api/documents/${item.document.id}/preview`} target="_blank" rel="noreferrer">Preview</a>{canEdit ? <Link className="inline-flex min-h-11 items-center font-bold text-[var(--primary)] underline" href={`/vault/${item.document.id}/edit?returnTo=${returnTo}`}>Replace</Link> : null}</div></div> : null}
      {!item.satisfied && canEdit ? <Link className="mt-4 inline-flex min-h-11 items-center bg-[var(--primary)] px-4 font-bold text-white" href={`/vault/new?documentType=${item.documentTypeId}&returnTo=${returnTo}`}>Upload {item.label}</Link> : null}
    </li>)}</ol></section>
    <section className="mt-9 border border-[var(--border)] bg-white p-5"><h2 className="font-bold">Before staff review</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">ReqDocs checks the dates and details you enter. It does not verify authenticity or guarantee that an organisation will accept a document. Staff verification is still required.</p></section>
    {pack.readinessPercent === 100 && ["ready", "code_active"].includes(pack.status) ? <ShareAccessCode documents={pack.items.flatMap((item) => item.document ? [{ id: item.document.id, label: item.label, name: item.document.displayName }] : [])} organizationName={pack.service.organization.name} packId={pack.id} /> : null}
    {canEdit ? <div className="mt-8"><CancelPackButton packId={pack.id} /></div> : null}
  </main>;
}
