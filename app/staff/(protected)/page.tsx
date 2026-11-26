import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/require-role";
import { CodeEntryForm } from "@/components/staff/code-entry-form";
import { listStaffProcessed } from "@/lib/history/server";

export const metadata: Metadata = {
  title: "Staff dashboard | ReqDocs",
};

export default async function StaffDashboardPage({ searchParams }: { searchParams: Promise<{ outcome?: string }> }) {
  const profile = await requireRole("staff");
  const recent = await listStaffProcessed(profile.id);
  const outcome = (await searchParams).outcome;

  return (
    <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
      <p className="text-sm font-bold uppercase tracking-[0.15em] text-[var(--primary)]">
        Staff workspace
      </p>
      <h1 className="mt-3 text-3xl font-bold tracking-[-0.025em] sm:text-4xl">
        Staff dashboard
      </h1>
      {outcome ? <p className="mt-6 border-l-4 border-emerald-700 bg-emerald-50 p-4 font-bold text-emerald-900" role="status">{outcome === "received" ? "Documents received for processing was recorded." : "The change request was sent to the individual."}</p> : null}
      <section
        aria-labelledby="staff-access-ready"
        className="mt-8 max-w-2xl border border-[var(--border)] bg-white p-6 sm:p-8"
      >
        <h2 className="text-xl font-bold" id="staff-access-ready">
          Receive a Service Pack
        </h2>
        <p className="mt-3 leading-7 text-[var(--muted)]">
          You are signed in for {profile.organizationName ?? "your organisation"}.
          Enter the code shown by the individual. Codes work once and expire after
          10 minutes; opened packs remain available for 15 minutes.
        </p>
        <CodeEntryForm />
      </section>
      <section className="mt-10" aria-labelledby="recently-processed"><h2 className="text-2xl font-bold" id="recently-processed">Recently processed</h2>{recent.length ? <ol className="mt-4 divide-y divide-[var(--border)] border border-[var(--border)] bg-white">{recent.map((event) => <li className="p-5" key={event.id}><p className="font-bold">{event.action}</p><p className="mt-1 text-sm text-[var(--muted)]">{event.serviceName} · {new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Johannesburg" }).format(new Date(event.createdAt))}</p><p className="mt-2 text-sm">File access is not renewed by this summary.</p></li>)}</ol> : <p className="mt-4 border border-[var(--border)] bg-white p-5 text-[var(--muted)]">No processed packs yet.</p>}</section>
    </main>
  );
}
