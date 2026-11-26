"use client";

import { useEffect, useRef, useState } from "react";

type SharedDocument = { id: string; label: string; name: string };

export function ShareAccessCode({ documents, organizationName, packId }: { documents: SharedDocument[]; organizationName: string; packId: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [code, setCode] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!expiresAt) return;
    const update = () => setSeconds(Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000)));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt]);

  async function generate() {
    setBusy(true); setError("");
    const response = await fetch(`/api/service-packs/${packId}/access-code`, { method: "POST" }).catch(() => null);
    const body = response ? await response.json().catch(() => ({})) as { data?: { code: string; expiresAt: string }; error?: { message?: string } } : {};
    if (!response?.ok || !body.data) { setError(body.error?.message ?? "The access code could not be created."); setBusy(false); return; }
    setCode(body.data.code); setExpiresAt(body.data.expiresAt); setBusy(false); dialogRef.current?.close();
  }

  async function cancel() {
    setBusy(true); setError("");
    const response = await fetch(`/api/service-packs/${packId}/access-code`, { method: "DELETE" }).catch(() => null);
    if (!response?.ok) { setError("The access code could not be cancelled."); setBusy(false); return; }
    setCode(""); setExpiresAt(""); setSeconds(0); setBusy(false);
  }

  return <section aria-labelledby="share-heading" className="mt-9 border-2 border-[var(--primary)] bg-blue-50 p-5 sm:p-7">
    <h2 className="text-xl font-bold" id="share-heading">Share with staff</h2>
    {code && seconds > 0 ? <div className="mt-4" role="status" aria-live="polite"><p>Your one-time access code for {organizationName} is:</p><p className="mt-2 font-mono text-4xl font-bold tracking-[0.2em]" aria-label={`Access code ${code.split("").join(" ")}`}>{code}</p><p className="mt-2 text-sm font-bold">Expires in {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</p><p className="mt-2 text-sm text-[var(--muted)]">The code can be used once and is not copied automatically.</p><button className="mt-5 min-h-11 border border-red-700 bg-white px-4 font-bold text-red-800" disabled={busy} onClick={cancel} type="button">Cancel code</button></div> : <><p className="mt-2 leading-7 text-[var(--muted)]">Create a single-use code that expires after 10 minutes. Staff access expires 15 minutes after redemption.</p><button className="mt-5 min-h-12 bg-[var(--primary)] px-5 font-bold text-white" onClick={() => dialogRef.current?.showModal()} type="button">Generate access code</button></>}
    {error ? <p className="mt-4 font-bold text-red-800" role="alert">{error}</p> : null}
    <dialog className="m-auto w-[min(42rem,calc(100%-2rem))] border border-[var(--border)] bg-white p-0 backdrop:bg-slate-950/60" ref={dialogRef} onCancel={() => setError("")}>
      <div className="p-6 sm:p-8"><h2 className="text-2xl font-bold">Confirm what staff can see</h2><p className="mt-3 leading-7">This code is intended for <strong>{organizationName}</strong>. It shares only these documents:</p><ul className="mt-4 list-disc space-y-2 pl-6">{documents.map((document) => <li key={document.id}><span className="font-bold">{document.label}:</span> {document.name}</li>)}</ul><p className="mt-4 text-sm leading-6 text-[var(--muted)]">The code expires in 10 minutes and can be used once. A matching staff member receives read-only access to this pack for 15 minutes.</p><div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button className="min-h-11 border border-[var(--border)] px-4 font-bold" disabled={busy} onClick={() => dialogRef.current?.close()} type="button">Go back</button><button className="min-h-11 bg-[var(--primary)] px-4 font-bold text-white" disabled={busy} onClick={generate} type="button">{busy ? "Generating…" : "Confirm and generate"}</button></div></div>
    </dialog>
  </section>;
}
