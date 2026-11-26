import { describe, expect, it } from "vitest";
import {
  canAccessArea,
  getRoleHome,
  getRoleLogin,
  isUserRole,
} from "./roles";

describe("role routing", () => {
  it("routes each role to its own home and login page", () => {
    expect(getRoleHome("individual")).toBe("/dashboard");
    expect(getRoleLogin("individual")).toBe("/login");
    expect(getRoleHome("staff")).toBe("/staff");
    expect(getRoleLogin("staff")).toBe("/staff/login");
  });

  it("does not allow a role into the other protected area", () => {
    expect(canAccessArea("individual", "individual")).toBe(true);
    expect(canAccessArea("individual", "staff")).toBe(false);
    expect(canAccessArea("staff", "staff")).toBe(true);
    expect(canAccessArea("staff", "individual")).toBe(false);
  });

  it("accepts exactly the two configured application roles", () => {
    expect(isUserRole("individual")).toBe(true);
    expect(isUserRole("staff")).toBe(true);
    expect(isUserRole("admin")).toBe(false);
    expect(isUserRole(undefined)).toBe(false);
  });
});
