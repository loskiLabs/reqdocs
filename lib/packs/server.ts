import type { SupabaseClient } from "@supabase/supabase-js";
import { calculateNextAction, type PackStatus, type RequirementResult } from "./evaluation";

type MaybeArray<T> = T | T[] | null;

export type ServiceSummary = {
  blankFormPath: string | null;
  description: string;
  destinationText: string;
  id: string;
  name: string;
  organization: { id: string; name: string; shortName: string };
  requirementCount: number;
};

export type PackSummary = {
  createdAt: string;
  id: string;
  nextAction: string;
  readinessPercent: number;
  service: ServiceSummary;
  status: PackStatus;
  updatedAt: string;
};

export type PackItem = {
  document: null | {
    displayName: string;
    expiresOn: string | null;
    id: string;
    originalFilename: string;
    validFrom: string;
  };
  id: string;
  label: string;
  reason: string;
  requirementId: string;
  result: RequirementResult;
  satisfied: boolean;
  sortOrder: number;
  documentTypeId: string;
  helpText: string;
};

export type PackDetail = PackSummary & {
  items: PackItem[];
  staffFeedback: string | null;
};

function one<T>(value: MaybeArray<T>): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

const SERVICE_SELECT =
  "id, name, description, destination_text, blank_form_path, organizations(id, name, short_name), service_requirements(id)";

export async function listServices(supabase: SupabaseClient): Promise<ServiceSummary[]> {
  const { data, error } = await supabase
    .from("services")
    .select(SERVICE_SELECT)
    .eq("active", true)
    .order("name");

  if (error) throw new Error("Unable to load services.");

  return (data ?? []).map((raw) => {
    const row = raw as unknown as {
      blank_form_path: string | null;
      description: string;
      destination_text: string;
      id: string;
      name: string;
      organizations: MaybeArray<{ id: string; name: string; short_name: string }>;
      service_requirements: Array<{ id: string }> | null;
    };
    const organization = one(row.organizations);
    if (!organization) throw new Error("Service organisation is unavailable.");
    return {
      blankFormPath: row.blank_form_path,
      description: row.description,
      destinationText: row.destination_text,
      id: row.id,
      name: row.name,
      organization: {
        id: organization.id,
        name: organization.name,
        shortName: organization.short_name,
      },
      requirementCount: row.service_requirements?.length ?? 0,
    };
  });
}

const PACK_SELECT = `${"id, status, readiness_percent, staff_feedback, created_at, updated_at"}, services(${SERVICE_SELECT})`;

function toPackSummary(raw: unknown): PackSummary {
  const row = raw as {
    created_at: string;
    id: string;
    readiness_percent: number;
    services: MaybeArray<{
      blank_form_path: string | null;
      description: string;
      destination_text: string;
      id: string;
      name: string;
      organizations: MaybeArray<{ id: string; name: string; short_name: string }>;
      service_requirements: Array<{ id: string }> | null;
    }>;
    status: PackStatus;
    updated_at: string;
  };
  const serviceRow = one(row.services);
  const organization = serviceRow ? one(serviceRow.organizations) : null;
  if (!serviceRow || !organization) throw new Error("Service Pack definition is unavailable.");
  const service: ServiceSummary = {
    blankFormPath: serviceRow.blank_form_path,
    description: serviceRow.description,
    destinationText: serviceRow.destination_text,
    id: serviceRow.id,
    name: serviceRow.name,
    organization: { id: organization.id, name: organization.name, shortName: organization.short_name },
    requirementCount: serviceRow.service_requirements?.length ?? 0,
  };
  return {
    createdAt: row.created_at,
    id: row.id,
    nextAction: calculateNextAction({ readinessPercent: row.readiness_percent, status: row.status }),
    readinessPercent: row.readiness_percent,
    service,
    status: row.status,
    updatedAt: row.updated_at,
  };
}

export async function listOwnedPacks(supabase: SupabaseClient, ownerId: string): Promise<PackSummary[]> {
  const { data, error } = await supabase
    .from("service_packs")
    .select(PACK_SELECT)
    .eq("owner_id", ownerId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error("Unable to load Service Packs.");
  return (data ?? []).map(toPackSummary);
}

export async function getOwnedPack(
  supabase: SupabaseClient,
  packId: string,
  ownerId: string,
): Promise<PackDetail | null> {
  const { data: pack, error } = await supabase
    .from("service_packs")
    .select(PACK_SELECT)
    .eq("id", packId)
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (error || !pack) return null;

  const { data: itemRows, error: itemError } = await supabase
    .from("service_pack_items")
    .select("id, result, result_reason, satisfied, service_requirement_id, service_requirements(id, label, sort_order, document_type_id, help_text), documents(id, display_name, original_filename, valid_from, expires_on)")
    .eq("service_pack_id", packId);
  if (itemError) throw new Error("Unable to load Service Pack items.");

  const summary = toPackSummary(pack);
  const items = (itemRows ?? []).map((raw) => {
    const row = raw as unknown as {
      documents: MaybeArray<{ display_name: string; expires_on: string | null; id: string; original_filename: string; valid_from: string }>;
      id: string;
      result: RequirementResult;
      result_reason: string;
      satisfied: boolean;
      service_requirement_id: string;
      service_requirements: MaybeArray<{ document_type_id: string; help_text: string; id: string; label: string; sort_order: number }>;
    };
    const requirement = one(row.service_requirements);
    const document = one(row.documents);
    if (!requirement) throw new Error("Service requirement is unavailable.");
    return {
      document: document ? {
        displayName: document.display_name,
        expiresOn: document.expires_on,
        id: document.id,
        originalFilename: document.original_filename,
        validFrom: document.valid_from,
      } : null,
      documentTypeId: requirement.document_type_id,
      helpText: requirement.help_text,
      id: row.id,
      label: requirement.label,
      reason: row.result_reason,
      requirementId: row.service_requirement_id,
      result: row.result,
      satisfied: row.satisfied,
      sortOrder: requirement.sort_order,
    } satisfies PackItem;
  }).sort((a, b) => a.sortOrder - b.sortOrder);

  return {
    ...summary,
    items,
    staffFeedback: (pack as { staff_feedback: string | null }).staff_feedback,
  };
}
