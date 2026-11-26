import Link from "next/link";
import { signOut } from "@/app/(auth)/actions";

type AccountHeaderProps = {
  displayName: string;
  homeHref: "/dashboard" | "/staff";
  label: string;
};

export function AccountHeader({
  displayName,
  homeHref,
  label,
}: AccountHeaderProps) {
  return (
    <header className="border-b border-[var(--border)] bg-white">
      <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
        <Link className="flex min-h-11 items-center text-lg font-bold" href={homeHref}>
          <span aria-hidden="true" className="mr-2 text-[var(--primary)]">
            ✓
          </span>
          ReqDocs
        </Link>
        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-bold">{displayName}</p>
            <p className="text-xs text-[var(--muted)]">{label}</p>
          </div>
          <form action={signOut}>
            <button
              className="min-h-11 border border-[var(--border)] bg-white px-4 text-sm font-bold hover:border-slate-500"
              type="submit"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
