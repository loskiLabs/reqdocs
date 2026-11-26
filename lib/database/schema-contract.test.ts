import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const schemaSql = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260822001000_initial_schema.sql",
  ),
  "utf8",
).toLowerCase();

const seedSql = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260822002000_seed_service_definitions.sql",
  ),
  "utf8",
).toLowerCase();

const storageSql = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260822000000_create_documents_bucket.sql",
  ),
  "utf8",
).toLowerCase();

const exposedTables = [
  "organizations",
  "profiles",
  "document_types",
  "documents",
  "services",
  "service_requirements",
  "service_packs",
  "service_pack_items",
  "access_codes",
  "pack_access_grants",
  "access_events",
];

describe("database security contract", () => {
  it("enables row level security on every exposed application table", () => {
    for (const table of exposedTables) {
      expect(schemaSql).toContain(
        `alter table public.${table} enable row level security;`,
      );
    }
  });

  it("keeps public registration individual-only", () => {
    expect(schemaSql).toContain("create trigger on_auth_user_created");
    expect(schemaSql).toContain("'individual',\n    case when char_length(requested_name)");
    expect(schemaSql).not.toContain("raw_user_meta_data ->> 'role'");
    expect(schemaSql).not.toContain("raw_user_meta_data ->> 'organization_id'");
  });

  it("requires ownership or a current organisation-matched grant", () => {
    expect(schemaSql).toContain("owner_id = auth.uid()");
    expect(schemaSql).toContain("grants.staff_id = auth.uid()");
    expect(schemaSql).toContain(
      "grants.organization_id = public.current_user_organization_id()",
    );
    expect(schemaSql).toContain("grants.expires_at > now()");
  });

  it("does not grant direct client access to code hashes or audit writes", () => {
    expect(schemaSql).not.toContain(
      "grant select on public.access_codes to authenticated",
    );
    expect(schemaSql).not.toContain(
      "grant insert on public.access_events to authenticated",
    );
    expect(schemaSql).not.toContain(
      "grant update on public.access_events to authenticated",
    );
  });

  it("constrains personal file metadata and the private Storage bucket", () => {
    expect(schemaSql).toContain(
      "mime_type in ('application/pdf', 'image/jpeg', 'image/png')",
    );
    expect(schemaSql).toContain("size_bytes between 1 and 10485760");
    expect(schemaSql).toContain(
      "storage_path ~ '^users/[0-9a-f-]+/[0-9a-f-]+/'",
    );
    expect(storageSql).toContain("'documents',\n  'documents',\n  false");
    expect(storageSql).toContain("10485760");
  });
});

describe("service seed contract", () => {
  it("contains exactly the two configured services and eight requirements", () => {
    expect(seedSql).toContain("uj_external_bursary_allowance_2026");
    expect(seedSql).toContain("motor_vehicle_licence_disc_renewal");
    expect(seedSql.match(/'10000000-0000-4000-8000-00000000000[1-5]'/g)).toHaveLength(
      5,
    );
    expect(seedSql.match(/'20000000-0000-4000-8000-00000000000[1-3]'/g)).toHaveLength(
      3,
    );
  });

  it("uses the exact public blank-form paths", () => {
    expect(seedSql).toContain("/forms/external-bursary-allowance-form-2026.pdf");
    expect(seedSql).toContain("/forms/vehiclelicenserenewalform.pdf");
  });
});
