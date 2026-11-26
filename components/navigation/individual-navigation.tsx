"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/vault", label: "Document Vault" },
  { href: "/packs", label: "Service Packs" },
  { href: "/history", label: "Access History" },
] as const;

function isCurrent(pathname: string, href: string): boolean {
  return href === "/dashboard"
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
}

export function IndividualNavigation() {
  const pathname = usePathname();

  return (
    <>
      <nav
        aria-label="Individual workspace"
        className="hidden border-b border-[var(--border)] bg-white md:block"
      >
        <div className="mx-auto flex max-w-6xl gap-8 px-8">
          {links.map((link) => {
            const current = isCurrent(pathname, link.href);
            return (
              <Link
                aria-current={current ? "page" : undefined}
                className={`flex min-h-12 items-center border-b-2 text-sm font-bold ${
                  current
                    ? "border-[var(--primary)] text-[var(--primary)]"
                    : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
                href={link.href}
                key={link.href}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </nav>
      <nav
        aria-label="Individual workspace"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--border)] bg-white md:hidden"
      >
        <div className="grid grid-cols-4">
          {links.map((link) => {
            const current = isCurrent(pathname, link.href);
            return (
              <Link
                aria-current={current ? "page" : undefined}
                className={`flex min-h-16 items-center justify-center px-3 text-center text-sm font-bold ${
                  current
                    ? "bg-blue-50 text-[var(--primary)]"
                    : "text-[var(--muted)]"
                }`}
                href={link.href}
                key={link.href}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
