import { apiError } from "@/lib/api/responses";
import { createClient } from "@/lib/supabase/server";
import { isUserRole, type UserRole } from "./roles";

export type ApiProfile = {
  displayName: string;
  id: string;
  organizationId: string | null;
  role: UserRole;
};

export async function requireApiRole(requiredRole: UserRole) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      errorResponse: apiError(
        "UNAUTHENTICATED",
        "Sign in to continue.",
        401,
      ),
    } as const;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role, display_name, organization_id")
    .eq("id", user.id)
    .single();

  if (
    profileError ||
    !profile ||
    !isUserRole(profile.role) ||
    profile.role !== requiredRole
  ) {
    return {
      errorResponse: apiError(
        "FORBIDDEN",
        "This account cannot perform that action.",
        403,
      ),
    } as const;
  }

  return {
    profile: {
      displayName: profile.display_name,
      id: profile.id,
      organizationId: profile.organization_id,
      role: profile.role,
    } satisfies ApiProfile,
    supabase,
  } as const;
}
