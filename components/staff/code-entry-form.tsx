"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CodeEntryForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    const response = await fetch("/api/staff/access-codes/redeem", { body: JSON.stringify({ code }), headers: { "content-type": "application/json" }, method: "POST" }).catch(() => null);
    const body = response ? await response.json().catch(() => ({})) as { data?: { packId: string }; error?: { message?: string } } : {};
    if (!response?.ok || !body.data) { setError(body.error?.message ?? "This code is invalid or no longer available. Ask the user to generate a new code."); setBusy(false); return; }
    router.push(`/staff/packs/${body.data.packId}`); router.refresh();
  }
  return <form className="mt-6" onSubmit={submit} noValidate>{error ? <div className="mb-4 border-l-4 border-red-700 bg-red-50 p-4 text-red-900" role="alert" tabIndex={-1}><h2 className="font-bold">Code not accepted</h2><p className="mt-1 text-sm">{error}</p></div> : null}<label className="block font-bold" htmlFor="access-code">Six-digit access code<input autoComplete="one-time-code" className="mt-2 min-h-14 w-full max-w-sm border border-slate-400 px-4 font-mono text-2xl tracking-[0.25em]" id="access-code" inputMode="numeric" maxLength={6} pattern="[0-9]{6}" required value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} /></label><button className="mt-5 min-h-12 bg-[var(--primary)] px-5 font-bold text-white disabled:opacity-60" disabled={busy || code.length !== 6} type="submit">{busy ? "Checking…" : "Open Service Pack"}</button></form>;
}
