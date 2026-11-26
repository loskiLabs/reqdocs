import { AccountHeader } from "@/components/navigation/account-header";
import { IndividualNavigation } from "@/components/navigation/individual-navigation";
import { requireRole } from "@/lib/auth/require-role";

export const dynamic = "force-dynamic";

export default async function IndividualLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const profile = await requireRole("individual");

  return (
    <div className="min-h-screen bg-[var(--background)] pb-16 md:pb-0">
      <AccountHeader
        displayName={profile.displayName}
        homeHref="/dashboard"
        label="Individual account"
      />
      <IndividualNavigation />
      {children}
    </div>
  );
}
