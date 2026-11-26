import { redirect } from "next/navigation";
import { cache } from "react";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import {
  canAccessArea,
  getRoleHome,
  getRoleLogin,
  isUserRole,
  type UserRole,
} from "./roles";

export type AuthenticatedProfile = {
  displayName: string;
  id: string;
  organizationId: string | null;
  organizationName: string | null;
  role: UserRole;
};

export const requireRole = cache(async function requireRole(
  requiredRole: UserRole,
): Promise<AuthenticatedProfile> {
  if (!isSupabaseConfigured()) {
    redirect(getRoleLogin(requiredRole));
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect(getRoleLogin(requiredRole));
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role, display_name, organization_id")
    .eq("id", user.id)
    .single();

  if (profileError || !profile || !isUserRole(profile.role)) {
    await supabase.auth.signOut();
    redirect(getRoleLogin(requiredRole));
  }

  if (!canAccessArea(profile.role, requiredRole)) {
    redirect(getRoleHome(profile.role));
  }

  let organizationName: string | null = null;

  if (profile.organization_id) {
    const { data: organization } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", profile.organization_id)
      .single();

    organizationName = organization?.name ?? null;
  }

  return {
    displayName: profile.display_name,
    id: profile.id,
    organizationId: profile.organization_id,
    organizationName,
    role: profile.role,
  };
});
