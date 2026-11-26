"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ServiceSummary } from "@/lib/packs/server";

export function ServicePicker({ services }: { services: ServiceSummary[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function create(serviceId: string) {
    setBusyId(serviceId);
    setError("");
    try {
      const response = await fetch("/api/service-packs", {
        body: JSON.stringify({ serviceId }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const body = (await response.json()) as { data?: { id: string }; error?: { message?: string } };
      if (!response.ok || !body.data) {
        setError(body.error?.message ?? "We could not create this Service Pack.");
        return;
      }
      router.push(`/packs/${body.data.id}`);
      router.refresh();
    } catch {
      setError("Check your connection and try again.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-5">
      {error ? <p className="border-l-4 border-red-700 bg-red-50 p-4 text-red-900" role="alert">{error}</p> : null}
      <div className="grid gap-5 md:grid-cols-2">
        {services.map((service) => (
          <article className="flex flex-col border border-[var(--border)] bg-white p-6" key={service.id}>
            <p className="text-sm font-bold text-[var(--primary)]">{service.organization.shortName}</p>
            <h2 className="mt-2 text-xl font-bold">{service.name}</h2>
            <p className="mt-3 grow leading-7 text-[var(--muted)]">{service.description}</p>
            <p className="mt-4 text-sm font-bold">{service.requirementCount} required documents</p>
            <button
              className="mt-5 min-h-12 bg-[var(--primary)] px-5 font-bold text-white hover:bg-[var(--primary-hover)] disabled:opacity-60"
              disabled={busyId !== null}
              onClick={() => create(service.id)}
              type="button"
            >
              {busyId === service.id ? "Preparing…" : "Prepare this Service Pack"}
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}
