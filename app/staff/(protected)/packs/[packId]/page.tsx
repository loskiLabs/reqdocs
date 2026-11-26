import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/require-role";
import { getGrantedStaffPack } from "@/lib/staff/server";
import { createClient } from "@/lib/supabase/server";
import { PackOutcomes } from "@/components/staff/pack-outcomes";

export default async function StaffPackPage({ params }: { params: Promise<{ packId: string }> }) {
  const profile = await requireRole("staff");
  if (!profile.organizationId) notFound();
  const { packId } = await params;
  const pack = await getGrantedStaffPack(await createClient(), packId, profile.id, profile.organizationId);
  if (!pack) redirect("/staff?access=expired");
  return <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
    <Link className="inline-flex min-h-11 items-center font-bold text-[var(--primary)] underline" href="/staff">Receive another pack</Link>
    <p className="mt-6 text-sm font-bold uppercase tracking-[0.15em] text-[var(--primary)]">Temporary read-only access</p><h1 className="mt-3 text-3xl font-bold sm:text-4xl">{pack.serviceName}</h1><p className="mt-3 text-[var(--muted)]">Prepared by {pack.ownerDisplayName} for {pack.organizationName}.</p><p className="mt-2 font-bold">Access expires {new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Johannesburg" }).format(new Date(pack.grantExpiresAt))}</p>
    <section className="mt-8" aria-labelledby="staff-requirements"><h2 className="text-2xl font-bold" id="staff-requirements">Shared documents</h2><ol className="mt-5 space-y-4">{pack.items.map((item) => <li className="border border-[var(--border)] bg-white p-5" key={item.id}><h3 className="font-bold">{item.sortOrder}. {item.label}</h3><p className="mt-2 text-sm text-[var(--muted)]">{item.reason}</p>{item.document ? <div className="mt-4 bg-slate-50 p-4"><p className="font-bold">{item.document.displayName}</p><p className="mt-1 break-all text-sm">{item.document.originalFilename}</p><a className="mt-3 inline-flex min-h-11 items-center font-bold text-[var(--primary)] underline" href={`/api/staff/service-packs/${pack.id}/documents/${item.document.id}/preview`} target="_blank" rel="noreferrer">Preview document</a></div> : <p className="mt-3 font-bold text-red-800">No document shared</p>}</li>)}</ol></section>
    <aside className="mt-8 border-l-4 border-amber-600 bg-amber-50 p-5"><h2 className="font-bold">Staff verification is required</h2><p className="mt-2 text-sm leading-6">ReqDocs checks user-provided dates only. Confirm the documents through your normal process. Receiving documents does not mean the service is approved.</p></aside>
    <PackOutcomes items={pack.items.map((item) => ({ id: item.id, label: item.label }))} packId={pack.id} />
  </main>;
}
