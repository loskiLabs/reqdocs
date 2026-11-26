import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readMigration = (name: string) => readFileSync(resolve(process.cwd(), "supabase/migrations", name), "utf8").toLowerCase();
const packSql = readMigration("20260822005000_service_pack_engine.sql");
const sharingSql = readMigration("20260822006000_access_codes_and_staff_grants.sql");
const outcomeSql = readMigration("20260822007000_outcomes_and_history.sql");

describe("Service Pack database contract", () => {
  it("removes direct client writes to calculated pack state", () => {
    expect(packSql).toContain("revoke insert, update, delete on public.service_packs from authenticated");
    expect(packSql).toContain("revoke insert, update, delete on public.service_pack_items from authenticated");
  });
  it("creates and recalculates packs through security-definer transactions", () => {
    expect(packSql).toContain("function public.create_service_pack");
    expect(packSql).toContain("function public.recalculate_service_pack");
    expect(packSql).toContain("for update");
    expect(packSql).toContain("today + 21");
  });
});

describe("temporary sharing database contract", () => {
  it("never grants clients access to the HMAC column", () => {
    expect(sharingSql).toContain("revoke select on public.access_codes from authenticated");
    expect(sharingSql).toContain("grant select (id, service_pack_id, expires_at, used_at, cancelled_at, created_at)");
  });
  it("locks redemption, checks organisation and creates a 15-minute grant", () => {
    expect(sharingSql).toContain("for update of code, pack");
    expect(sharingSql).toContain("pack_organization is distinct from staff_profile.organization_id");
    expect(sharingSql).toContain("interval '15 minutes'");
    expect(sharingSql).toContain("count(*) >= 5");
  });
  it("keeps outcome events append-only and revokes temporary grants", () => {
    expect(outcomeSql).toContain("'documents_received'");
    expect(outcomeSql).toContain("'changes_requested'");
    expect(outcomeSql).toContain("update public.pack_access_grants set revoked_at = now()");
    expect(outcomeSql).not.toContain("update public.access_events");
    expect(outcomeSql).not.toContain("delete from public.access_events");
  });
});
