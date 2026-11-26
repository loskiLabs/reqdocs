-- Server-owned Service Pack calculation. Apply after 20260822004000.

grant select on public.organizations, public.services, public.service_requirements,
  public.document_types, public.documents, public.service_packs,
  public.service_pack_items, public.access_codes to service_role;
grant insert, update, delete on public.documents to service_role;
grant insert, update, delete on public.service_packs, public.service_pack_items,
  public.access_codes to service_role;

-- Authenticated clients may read their RLS-scoped rows, but cannot write
-- calculated readiness or item results directly.
revoke insert, update, delete on public.service_packs from authenticated;
revoke insert, update, delete on public.service_pack_items from authenticated;

drop policy if exists service_packs_insert_own on public.service_packs;
drop policy if exists service_packs_update_own on public.service_packs;
drop policy if exists service_packs_delete_own on public.service_packs;
drop policy if exists service_pack_items_insert_owner on public.service_pack_items;
drop policy if exists service_pack_items_update_owner on public.service_pack_items;
drop policy if exists service_pack_items_delete_owner on public.service_pack_items;

create or replace function public.recalculate_service_pack(target_pack_id uuid)
returns public.service_packs
language plpgsql
security definer
set search_path = ''
as $$
declare
  pack_row public.service_packs%rowtype;
  requirement_row public.service_requirements%rowtype;
  candidate record;
  candidate_found boolean;
  evaluated_result public.requirement_result;
  evaluated_reason text;
  is_satisfied boolean;
  readiness integer;
  next_status public.pack_status;
  today date := (now() at time zone 'Africa/Johannesburg')::date;
begin
  select * into pack_row
  from public.service_packs
  where id = target_pack_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Service Pack not found';
  end if;

  if auth.uid() is distinct from pack_row.owner_id
    and coalesce(auth.role(), '') <> 'service_role' then
    raise exception using errcode = '42501', message = 'Not authorised';
  end if;

  for requirement_row in
    select * from public.service_requirements
    where service_id = pack_row.service_id
    order by sort_order
  loop
    select ranked.* into candidate
    from (
      select
        document.id,
        document.valid_from,
        document.created_at,
        document.reference_year,
        document.signed_attested,
        case
          when document.expires_on is null and requirement_row.freshness_months is null then null
          when document.expires_on is null then
            (document.valid_from + make_interval(months => requirement_row.freshness_months))::date
          when requirement_row.freshness_months is null then document.expires_on
          else least(
            document.expires_on,
            (document.valid_from + make_interval(months => requirement_row.freshness_months))::date
          )
        end as effective_expiry,
        case
          when requirement_row.required_reference_year is not null
            and document.reference_year is distinct from requirement_row.required_reference_year then false
          when requirement_row.requires_signed_attestation and not document.signed_attested then false
          when document.expires_on is null and requirement_row.freshness_months is null then
            requirement_row.allows_no_expiry
          when (
            case
              when document.expires_on is null then
                (document.valid_from + make_interval(months => requirement_row.freshness_months))::date
              when requirement_row.freshness_months is null then document.expires_on
              else least(
                document.expires_on,
                (document.valid_from + make_interval(months => requirement_row.freshness_months))::date
              )
            end
          ) < today then false
          else true
        end as passes
      from public.documents document
      where document.owner_id = pack_row.owner_id
        and document.document_type_id = requirement_row.document_type_id
        and document.deleted_at is null
    ) ranked
    order by ranked.passes desc, ranked.valid_from desc, ranked.created_at desc
    limit 1;
    candidate_found := found;

    if not candidate_found then
      evaluated_result := 'missing';
      evaluated_reason := 'Upload this required document.';
      is_satisfied := false;
    elsif requirement_row.required_reference_year is not null
      and candidate.reference_year is distinct from requirement_row.required_reference_year then
      evaluated_result := 'wrong_year';
      evaluated_reason := format('A %s document is required.', requirement_row.required_reference_year);
      is_satisfied := false;
    elsif requirement_row.requires_signed_attestation and not candidate.signed_attested then
      evaluated_result := 'unsigned';
      evaluated_reason := 'Confirm that the form is completed and signed.';
      is_satisfied := false;
    elsif candidate.effective_expiry is null and requirement_row.allows_no_expiry then
      evaluated_result := 'no_expiry';
      evaluated_reason := 'Current according to the dates provided; no expiry is recorded.';
      is_satisfied := true;
    elsif candidate.effective_expiry is null then
      evaluated_result := 'expired';
      evaluated_reason := 'An expiry date is required for this service.';
      is_satisfied := false;
    elsif candidate.effective_expiry < today then
      evaluated_result := 'expired';
      evaluated_reason := format('Expired on %s.', candidate.effective_expiry);
      is_satisfied := false;
    elsif candidate.effective_expiry <= today + 21 then
      evaluated_result := 'expiring_soon';
      evaluated_reason := format('Current, but reaches its service limit on %s.', candidate.effective_expiry);
      is_satisfied := true;
    else
      evaluated_result := 'current';
      evaluated_reason := format('Current according to the dates provided until %s.', candidate.effective_expiry);
      is_satisfied := true;
    end if;

    insert into public.service_pack_items (
      service_pack_id,
      service_requirement_id,
      document_id,
      result,
      result_reason,
      satisfied,
      evaluated_at
    ) values (
      pack_row.id,
      requirement_row.id,
      case when candidate_found then candidate.id else null end,
      evaluated_result,
      evaluated_reason,
      is_satisfied,
      now()
    )
    on conflict (service_pack_id, service_requirement_id) do update set
      document_id = excluded.document_id,
      result = excluded.result,
      result_reason = excluded.result_reason,
      satisfied = excluded.satisfied,
      evaluated_at = excluded.evaluated_at;
  end loop;

  delete from public.service_pack_items item
  where item.service_pack_id = pack_row.id
    and not exists (
      select 1 from public.service_requirements requirement
      where requirement.id = item.service_requirement_id
        and requirement.service_id = pack_row.service_id
    );

  select case
    when count(*) = 0 then 0
    else round(count(*) filter (where satisfied)::numeric / count(*)::numeric * 100)::integer
  end into readiness
  from public.service_pack_items
  where service_pack_id = pack_row.id;

  next_status := case
    when pack_row.status in ('cancelled', 'documents_received') then pack_row.status
    when readiness = 100 and pack_row.status in ('code_active', 'viewed') then pack_row.status
    when readiness = 100 then 'ready'::public.pack_status
    else 'draft'::public.pack_status
  end;

  if readiness < 100 then
    update public.access_codes
    set cancelled_at = now()
    where service_pack_id = pack_row.id
      and used_at is null
      and cancelled_at is null;
  end if;

  update public.service_packs
  set readiness_percent = readiness,
      status = next_status,
      staff_feedback = case when next_status = 'ready' then null else staff_feedback end
  where id = pack_row.id
  returning * into pack_row;

  return pack_row;
end;
$$;

create or replace function public.create_service_pack(target_service_id text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  pack_id uuid;
begin
  if auth.uid() is null or public.current_user_role() <> 'individual' then
    raise exception using errcode = '42501', message = 'Not authorised';
  end if;

  if not exists (
    select 1 from public.services where id = target_service_id and active
  ) then
    raise exception using errcode = 'P0002', message = 'Service not found';
  end if;

  insert into public.service_packs (owner_id, service_id)
  values (auth.uid(), target_service_id)
  returning id into pack_id;

  perform public.recalculate_service_pack(pack_id);
  return pack_id;
end;
$$;

create or replace function public.recalculate_owner_service_packs()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  active_pack record;
begin
  if auth.uid() is null or public.current_user_role() <> 'individual' then
    raise exception using errcode = '42501', message = 'Not authorised';
  end if;

  for active_pack in
    select id from public.service_packs
    where owner_id = auth.uid()
      and status not in ('cancelled', 'documents_received')
  loop
    perform public.recalculate_service_pack(active_pack.id);
  end loop;
end;
$$;

create or replace function public.cancel_service_pack(target_pack_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.service_packs
    where id = target_pack_id
      and owner_id = auth.uid()
      and status in ('draft', 'ready', 'code_active', 'needs_changes')
  ) then
    raise exception using errcode = 'P0002', message = 'Service Pack cannot be cancelled';
  end if;

  update public.access_codes
  set cancelled_at = now()
  where service_pack_id = target_pack_id
    and used_at is null
    and cancelled_at is null;

  update public.service_packs
  set status = 'cancelled', cancelled_at = now()
  where id = target_pack_id;
end;
$$;

revoke all on function public.recalculate_service_pack(uuid) from public, anon;
revoke all on function public.create_service_pack(text) from public, anon;
revoke all on function public.recalculate_owner_service_packs() from public, anon;
revoke all on function public.cancel_service_pack(uuid) from public, anon;
grant execute on function public.recalculate_service_pack(uuid) to authenticated, service_role;
grant execute on function public.create_service_pack(text) to authenticated;
grant execute on function public.recalculate_owner_service_packs() to authenticated;
grant execute on function public.cancel_service_pack(uuid) to authenticated;
