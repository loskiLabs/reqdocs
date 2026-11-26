import type { Metadata } from "next";
import Link from "next/link";
import { ServicePicker } from "@/components/packs/service-picker";
import { requireRole } from "@/lib/auth/require-role";
import { listServices } from "@/lib/packs/server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Prepare for a Service | ReqDocs" };

export default async function NewPackPage() {
  await requireRole("individual");
  const services = await listServices(await createClient());
  return <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
    <Link className="inline-flex min-h-11 items-center font-bold text-[var(--primary)] underline underline-offset-4" href="/packs">Back to Service Packs</Link>
    <p className="mt-6 text-sm font-bold uppercase tracking-[0.15em] text-[var(--primary)]">Prepare once, share narrowly</p>
    <h1 className="mt-3 text-3xl font-bold sm:text-4xl">Choose a service</h1>
    <p className="mt-3 max-w-2xl leading-7 text-[var(--muted)]">ReqDocs will check your Vault against the selected service. These are the only two services in this MVP.</p>
    <div className="mt-8"><ServicePicker services={services} /></div>
  </main>;
}
