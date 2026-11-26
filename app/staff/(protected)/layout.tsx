import { AccountHeader } from "@/components/navigation/account-header";
import { requireRole } from "@/lib/auth/require-role";

export const dynamic = "force-dynamic";

export default async function StaffLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const profile = await requireRole("staff");

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <AccountHeader
        displayName={profile.displayName}
        homeHref="/staff"
        label={profile.organizationName ?? "Staff account"}
      />
      {children}
    </div>
  );
}
