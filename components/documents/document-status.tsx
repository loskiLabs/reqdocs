import type { DocumentStatus as Status } from "@/lib/documents/validity";

const styles: Record<Status, string> = {
  current: "border-green-200 bg-green-50 text-green-800",
  expired: "border-red-200 bg-red-50 text-red-800",
  expiring_soon: "border-amber-300 bg-amber-50 text-amber-900",
  no_expiry: "border-slate-300 bg-slate-50 text-slate-700",
};

const markers: Record<Status, string> = {
  current: "✓",
  expired: "×",
  expiring_soon: "!",
  no_expiry: "—",
};

export function DocumentStatus({
  label,
  status,
}: {
  label: string;
  status: Status;
}) {
  return (
    <span
      className={`inline-flex min-h-8 items-center gap-2 border px-3 text-sm font-bold ${styles[status]}`}
    >
      <span aria-hidden="true">{markers[status]}</span>
      {label}
    </span>
  );
}
