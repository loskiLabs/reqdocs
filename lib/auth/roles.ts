export const userRoles = ["individual", "staff"] as const;

export type UserRole = (typeof userRoles)[number];

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && userRoles.includes(value as UserRole);
}

export function getRoleHome(role: UserRole): "/dashboard" | "/staff" {
  return role === "staff" ? "/staff" : "/dashboard";
}

export function getRoleLogin(role: UserRole): "/login" | "/staff/login" {
  return role === "staff" ? "/staff/login" : "/login";
}

export function canAccessArea(
  role: UserRole,
  area: "individual" | "staff",
): boolean {
  return role === area;
}
