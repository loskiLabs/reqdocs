-- Staff outcomes are explicit, grant-scoped, and append-only.

grant select on public.access_events to service_role;

create or replace function public.confirm_pack_documents_received(
  target_pack_id uuid,
  confirmation boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  staff_profile public.profiles%rowtype;
  shared_document_ids uuid[];
begin
  select * into staff_profile from public.profiles
  where id = auth.uid() and role = 'staff';
  if not found or not confirmation or not exists (
    select 1 from public.pack_access_grants grant_row
    join public.service_packs pack on pack.id = grant_row.service_pack_id
    join public.services service on service.id = pack.service_id
    where grant_row.service_pack_id = target_pack_id
      and grant_row.staff_id = staff_profile.id
      and grant_row.organization_id = staff_profile.organization_id
      and service.organization_id = staff_profile.organization_id
      and grant_row.revoked_at is null and grant_row.expires_at > now()
  ) then
    raise exception using errcode = '42501', message = 'Active access required';
  end if;

  select coalesce(array_agg(document_id order by id), '{}'::uuid[])
  into shared_document_ids from public.service_pack_items
  where service_pack_id = target_pack_id and document_id is not null;

  update public.service_packs set status = 'documents_received', staff_feedback = null
  where id = target_pack_id;
  insert into public.access_events (
    service_pack_id, actor_id, event_type, organization_id, document_ids,
    details
  ) values (
    target_pack_id, staff_profile.id, 'documents_received',
    staff_profile.organization_id, shared_document_ids,
    jsonb_build_object('message', 'Documents received for external processing')
  );
  update public.pack_access_grants set revoked_at = now()
  where service_pack_id = target_pack_id and revoked_at is null;
end;
$$;

create or replace function public.request_pack_changes(
  target_pack_id uuid,
  target_item_ids uuid[],
  target_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  staff_profile public.profiles%rowtype;
  shared_document_ids uuid[];
begin
  select * into staff_profile from public.profiles
  where id = auth.uid() and role = 'staff';
  if not found or char_length(trim(target_reason)) not between 10 and 500
    or coalesce(cardinality(target_item_ids), 0) = 0
    or exists (
      select 1 from unnest(target_item_ids) requested_id
      where not exists (
        select 1 from public.service_pack_items item
        where item.id = requested_id and item.service_pack_id = target_pack_id
      )
    )
    or not exists (
      select 1 from public.pack_access_grants grant_row
      join public.service_packs pack on pack.id = grant_row.service_pack_id
      join public.services service on service.id = pack.service_id
      where grant_row.service_pack_id = target_pack_id
        and grant_row.staff_id = staff_profile.id
        and grant_row.organization_id = staff_profile.organization_id
        and service.organization_id = staff_profile.organization_id
        and grant_row.revoked_at is null and grant_row.expires_at > now()
    ) then
    raise exception using errcode = '42501', message = 'Active access and valid feedback required';
  end if;

  select coalesce(array_agg(document_id order by id), '{}'::uuid[])
  into shared_document_ids from public.service_pack_items
  where service_pack_id = target_pack_id and document_id is not null;

  update public.service_packs
  set status = 'needs_changes', staff_feedback = trim(target_reason)
  where id = target_pack_id;
  update public.access_codes set cancelled_at = now()
  where service_pack_id = target_pack_id and used_at is null and cancelled_at is null;
  insert into public.access_events (
    service_pack_id, actor_id, event_type, organization_id, document_ids, details
  ) values (
    target_pack_id, staff_profile.id, 'changes_requested',
    staff_profile.organization_id, shared_document_ids,
    jsonb_build_object('itemIds', target_item_ids, 'reason', trim(target_reason))
  );
  update public.pack_access_grants set revoked_at = now()
  where service_pack_id = target_pack_id and revoked_at is null;
end;
$$;

revoke all on function public.confirm_pack_documents_received(uuid, boolean) from public, anon;
revoke all on function public.request_pack_changes(uuid, uuid[], text) from public, anon;
grant execute on function public.confirm_pack_documents_received(uuid, boolean) to authenticated;
grant execute on function public.request_pack_changes(uuid, uuid[], text) to authenticated;
