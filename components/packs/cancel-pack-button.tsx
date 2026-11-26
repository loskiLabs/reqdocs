"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CancelPackButton({ packId }: { packId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function cancel() {
    if (!window.confirm("Cancel this Service Pack? Any unused access code will also be cancelled.")) return;
    setBusy(true);
    const response = await fetch(`/api/service-packs/${packId}/cancel`, { method: "POST" }).catch(() => null);
    if (!response?.ok) {
      setError("The Service Pack could not be cancelled.");
      setBusy(false);
      return;
    }
    router.push("/packs?cancelled=1");
    router.refresh();
  }

  return (
    <div>
      {error ? <p className="mb-3 text-sm font-bold text-red-800" role="alert">{error}</p> : null}
      <button className="min-h-11 border border-red-700 px-4 font-bold text-red-800 hover:bg-red-50 disabled:opacity-60" disabled={busy} onClick={cancel} type="button">
        {busy ? "Cancelling…" : "Cancel Service Pack"}
      </button>
    </div>
  );
}
