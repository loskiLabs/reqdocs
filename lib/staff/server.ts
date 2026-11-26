import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { RequirementResult } from "@/lib/packs/evaluation";

export type StaffPack = {
  grantExpiresAt: string;
  id: string;
  organizationName: string;
  ownerDisplayName: string;
  readinessPercent: number;
  serviceName: string;
  status: string;
  items: Array<{
    document: null | { displayName: string; id: string; originalFilename: string; validFrom: string };
    id: string;
    label: string;
    reason: string;
    result: RequirementResult;
    satisfied: boolean;
    sortOrder: number;
  }>;
};

export async function getActiveGrant(supabase: SupabaseClient, packId: string, staffId: string, organizationId: string) {
  const { data } = await supabase.from("pack_access_grants").select("expires_at").eq("service_pack_id", packId).eq("staff_id", staffId).eq("organization_id", organizationId).is("revoked_at", null).gt("expires_at", new Date().toISOString()).order("expires_at", { ascending: false }).limit(1).maybeSingle();
  return data?.expires_at ?? null;
}

function relation<T>(value: T | T[] | null): T | null { return Array.isArray(value) ? value[0] ?? null : value; }

export async function getGrantedStaffPack(supabase: SupabaseClient, packId: string, staffId: string, organizationId: string): Promise<StaffPack | null> {
  const grantExpiresAt = await getActiveGrant(supabase, packId, staffId, organizationId);
  if (!grantExpiresAt) return null;
  const admin = createAdminClient();
  const { data: pack } = await admin.from("service_packs").select("id, owner_id, status, readiness_percent, profiles(display_name), services(name, organization_id, organizations(name))").eq("id", packId).maybeSingle();
  if (!pack) return null;
  const service = relation(pack.services as unknown as { name: string; organization_id: string; organizations: { name: string } | { name: string }[] | null } | null);
  if (!service || service.organization_id !== organizationId) return null;
  const organization = relation(service.organizations);
  const owner = relation(pack.profiles as unknown as { display_name: string } | { display_name: string }[] | null);
  const { data: rows } = await admin.from("service_pack_items").select("id, result, result_reason, satisfied, service_requirements(label, sort_order), documents(id, display_name, original_filename, valid_from)").eq("service_pack_id", packId);
  const items = (rows ?? []).map((raw) => {
    const requirement = relation(raw.service_requirements as unknown as { label: string; sort_order: number } | { label: string; sort_order: number }[] | null);
    const document = relation(raw.documents as unknown as { display_name: string; id: string; original_filename: string; valid_from: string } | { display_name: string; id: string; original_filename: string; valid_from: string }[] | null);
    return { document: document ? { displayName: document.display_name, id: document.id, originalFilename: document.original_filename, validFrom: document.valid_from } : null, id: raw.id, label: requirement?.label ?? "Requirement", reason: raw.result_reason, result: raw.result as RequirementResult, satisfied: raw.satisfied, sortOrder: requirement?.sort_order ?? 0 };
  }).sort((a, b) => a.sortOrder - b.sortOrder);
  return { grantExpiresAt, id: pack.id, items, organizationName: organization?.name ?? "Your organisation", ownerDisplayName: owner?.display_name ?? "ReqDocs user", readinessPercent: pack.readiness_percent, serviceName: service.name, status: pack.status };
}
