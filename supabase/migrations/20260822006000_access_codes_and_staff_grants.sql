-- Short-lived consent codes and organisation-scoped staff grants.

create table if not exists public.access_code_redemption_attempts (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.profiles(id) on delete cascade,
  ip_hash text not null check (char_length(ip_hash) = 64),
  succeeded boolean not null,
  created_at timestamptz not null default now()
);

create index if not exists access_code_attempts_rate_idx
  on public.access_code_redemption_attempts (staff_id, created_at desc)
  where not succeeded;

alter table public.access_code_redemption_attempts enable row level security;
revoke all on public.access_code_redemption_attempts from public, anon, authenticated;
grant select, insert on public.access_code_redemption_attempts to service_role;

-- Owners may inspect code lifetime/state, never the stored HMAC.
revoke select on public.access_codes from authenticated;
grant select (id, service_pack_id, expires_at, used_at, cancelled_at, created_at)
  on public.access_codes to authenticated;
grant insert, update on public.access_codes, public.pack_access_grants,
  public.access_events to service_role;

create or replace function public.create_pack_access_code(
  target_pack_id uuid,
  target_code_hash text
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  pack_row public.service_packs%rowtype;
  expiry timestamptz := now() + interval '10 minutes';
  organization uuid;
  shared_document_ids uuid[];
begin
  if target_code_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'Invalid code hash';
  end if;

  perform public.recalculate_service_pack(target_pack_id);

  select pack.* into pack_row
  from public.service_packs pack
  where pack.id = target_pack_id
    and pack.owner_id = auth.uid()
  for update of pack;

  if not found or pack_row.readiness_percent <> 100
    or pack_row.status not in ('ready', 'code_active') then
    raise exception using errcode = '55000', message = 'Service Pack is not ready';
  end if;

  select service.organization_id into organization
  from public.services service
  where service.id = pack_row.service_id;

  if exists (
    select 1 from public.pack_access_grants
    where service_pack_id = target_pack_id
      and revoked_at is null and expires_at > now()
  ) then
    raise exception using errcode = '55000', message = 'Staff access is active';
  end if;

  update public.access_codes set cancelled_at = now()
  where service_pack_id = target_pack_id
    and used_at is null and cancelled_at is null;

  insert into public.access_codes (service_pack_id, code_hash, expires_at)
  values (target_pack_id, target_code_hash, expiry);

  select coalesce(array_agg(document_id order by id), '{}'::uuid[])
  into shared_document_ids
  from public.service_pack_items
  where service_pack_id = target_pack_id and document_id is not null;

  insert into public.access_events (
    service_pack_id, actor_id, event_type, organization_id, document_ids
  ) values (
    target_pack_id, auth.uid(), 'code_generated', organization, shared_document_ids
  );

  update public.service_packs set status = 'code_active' where id = target_pack_id;
  return expiry;
end;
$$;

create or replace function public.cancel_pack_access_code(target_pack_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed integer;
  organization uuid;
begin
  select service.organization_id into organization
  from public.service_packs pack
  join public.services service on service.id = pack.service_id
  where pack.id = target_pack_id and pack.owner_id = auth.uid();
  if not found then
    raise exception using errcode = '42501', message = 'Not authorised';
  end if;

  update public.access_codes set cancelled_at = now()
  where service_pack_id = target_pack_id
    and used_at is null and cancelled_at is null and expires_at > now();
  get diagnostics changed = row_count;

  if changed > 0 then
    insert into public.access_events (service_pack_id, actor_id, event_type, organization_id)
    values (target_pack_id, auth.uid(), 'code_cancelled', organization);
    update public.service_packs set status = 'ready'
    where id = target_pack_id and status = 'code_active';
  end if;
  return changed > 0;
end;
$$;

create or replace function public.redeem_pack_access_code(
  target_code_hash text,
  target_ip_hash text
)
returns table (outcome text, pack_id uuid, grant_expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  staff_profile public.profiles%rowtype;
  code_id uuid;
  matched_pack_id uuid;
  pack_organization uuid;
  grant_expiry timestamptz := now() + interval '15 minutes';
  shared_document_ids uuid[];
begin
  select * into staff_profile from public.profiles
  where id = auth.uid() and role = 'staff';
  if not found then
    raise exception using errcode = '42501', message = 'Not authorised';
  end if;

  if (
    select count(*) >= 5 from public.access_code_redemption_attempts
    where staff_id = staff_profile.id and not succeeded
      and created_at > now() - interval '15 minutes'
  ) then
    return query select 'rate_limited'::text, null::uuid, null::timestamptz;
    return;
  end if;

  select code.id, pack.id, service.organization_id
  into code_id, matched_pack_id, pack_organization
  from public.access_codes code
  join public.service_packs pack on pack.id = code.service_pack_id
  join public.services service on service.id = pack.service_id
  where code.code_hash = target_code_hash
    and code.used_at is null
    and code.cancelled_at is null
    and code.expires_at > now()
    and pack.readiness_percent = 100
    and pack.status = 'code_active'
  for update of code, pack
  limit 1;

  if not found or pack_organization is distinct from staff_profile.organization_id then
    insert into public.access_code_redemption_attempts (staff_id, ip_hash, succeeded)
    values (staff_profile.id, target_ip_hash, false);
    return query select 'invalid'::text, null::uuid, null::timestamptz;
    return;
  end if;

  update public.access_codes set used_at = now() where id = code_id and used_at is null;
  if not found then
    insert into public.access_code_redemption_attempts (staff_id, ip_hash, succeeded)
    values (staff_profile.id, target_ip_hash, false);
    return query select 'invalid'::text, null::uuid, null::timestamptz;
    return;
  end if;

  insert into public.pack_access_grants (
    service_pack_id, staff_id, organization_id, expires_at
  ) values (
    matched_pack_id, staff_profile.id, staff_profile.organization_id, grant_expiry
  );

  select coalesce(array_agg(document_id order by id), '{}'::uuid[])
  into shared_document_ids from public.service_pack_items
  where service_pack_id = matched_pack_id and document_id is not null;

  insert into public.access_events (
    service_pack_id, actor_id, event_type, organization_id, document_ids
  ) values (
    matched_pack_id, staff_profile.id, 'pack_viewed', staff_profile.organization_id,
    shared_document_ids
  );
  insert into public.access_code_redemption_attempts (staff_id, ip_hash, succeeded)
  values (staff_profile.id, target_ip_hash, true);
  update public.service_packs set status = 'viewed' where id = matched_pack_id;

  return query select 'success'::text, matched_pack_id, grant_expiry;
end;
$$;

revoke all on function public.create_pack_access_code(uuid, text) from public, anon;
revoke all on function public.cancel_pack_access_code(uuid) from public, anon;
revoke all on function public.redeem_pack_access_code(text, text) from public, anon;
grant execute on function public.create_pack_access_code(uuid, text) to authenticated;
grant execute on function public.cancel_pack_access_code(uuid) to authenticated;
grant execute on function public.redeem_pack_access_code(text, text) to authenticated;
