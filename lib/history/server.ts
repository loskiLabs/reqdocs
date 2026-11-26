import { createAdminClient } from "@/lib/supabase/admin";

export type HistoryEvent = {
  action: string;
  actorName: string;
  createdAt: string;
  documentNames: string[];
  eventType: "changes_requested" | "code_cancelled" | "code_generated" | "documents_received" | "pack_viewed";
  id: string;
  organizationName: string | null;
  packId: string;
  reason: string | null;
  serviceName: string;
};

const actionLabels: Record<HistoryEvent["eventType"], string> = {
  changes_requested: "Changes requested",
  code_cancelled: "Access code cancelled",
  code_generated: "Access code generated",
  documents_received: "Documents received for processing",
  pack_viewed: "Service Pack viewed",
};

export async function listAccessHistory(ownerId: string, filters: { eventType?: string; packId?: string } = {}): Promise<HistoryEvent[]> {
  const admin = createAdminClient();
  let packQuery = admin.from("service_packs").select("id, service_id").eq("owner_id", ownerId);
  if (filters.packId) packQuery = packQuery.eq("id", filters.packId);
  const { data: packs } = await packQuery;
  if (!packs?.length) return [];
  let eventQuery = admin.from("access_events").select("id, service_pack_id, actor_id, event_type, organization_id, document_ids, details, created_at").in("service_pack_id", packs.map((pack) => pack.id)).order("created_at", { ascending: false });
  if (filters.eventType) eventQuery = eventQuery.eq("event_type", filters.eventType);
  const { data: events, error } = await eventQuery;
  if (error) throw new Error("Unable to load access history.");
  const actorIds = [...new Set((events ?? []).map((event) => event.actor_id))];
  const organizationIds = [...new Set((events ?? []).flatMap((event) => event.organization_id ? [event.organization_id] : []))];
  const documentIds = [...new Set((events ?? []).flatMap((event) => event.document_ids ?? []))];
  const serviceIds = [...new Set(packs.map((pack) => pack.service_id))];
  const [{ data: actors }, { data: organizations }, { data: documents }, { data: services }] = await Promise.all([
    actorIds.length ? admin.from("profiles").select("id, display_name").in("id", actorIds) : Promise.resolve({ data: [] }),
    organizationIds.length ? admin.from("organizations").select("id, name").in("id", organizationIds) : Promise.resolve({ data: [] }),
    documentIds.length ? admin.from("documents").select("id, display_name").in("id", documentIds) : Promise.resolve({ data: [] }),
    admin.from("services").select("id, name").in("id", serviceIds),
  ]);
  const packMap = new Map(packs.map((pack) => [pack.id, pack]));
  return (events ?? []).map((event) => {
    const type = event.event_type as HistoryEvent["eventType"];
    const details = event.details && typeof event.details === "object" ? event.details as Record<string, unknown> : {};
    const pack = packMap.get(event.service_pack_id);
    return {
      action: actionLabels[type], actorName: actors?.find((actor) => actor.id === event.actor_id)?.display_name ?? "ReqDocs user",
      createdAt: event.created_at, documentNames: (event.document_ids ?? []).map((id: string) => documents?.find((document) => document.id === id)?.display_name as string | undefined).filter((name: string | undefined): name is string => Boolean(name)),
      eventType: type, id: event.id, organizationName: organizations?.find((organization) => organization.id === event.organization_id)?.name ?? null,
      packId: event.service_pack_id, reason: typeof details.reason === "string" ? details.reason : null,
      serviceName: services?.find((service) => service.id === pack?.service_id)?.name ?? "Service Pack",
    };
  });
}

export async function listStaffProcessed(staffId: string, limit = 5): Promise<HistoryEvent[]> {
  const admin = createAdminClient();
  const { data } = await admin.from("access_events").select("id, service_pack_id").eq("actor_id", staffId).in("event_type", ["documents_received", "changes_requested"]).order("created_at", { ascending: false }).limit(limit);
  const packIds = [...new Set((data ?? []).map((row) => row.service_pack_id))];
  if (!packIds.length) return [];
  const { data: packs } = await admin.from("service_packs").select("id, owner_id").in("id", packIds);
  const owners = [...new Set((packs ?? []).map((pack) => pack.owner_id))];
  const histories = await Promise.all(owners.map((owner) => listAccessHistory(owner)));
  const eventIds = new Set((data ?? []).map((event) => event.id));
  return histories.flat().filter((event) => eventIds.has(event.id)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
}
