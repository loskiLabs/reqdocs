create extension if not exists pgcrypto;

create type public.user_role as enum ('individual', 'staff');
create type public.expiry_method as enum ('duration', 'fixed_date', 'none');
create type public.pack_status as enum (
  'draft',
  'ready',
  'code_active',
  'viewed',
  'documents_received',
  'needs_changes',
  'cancelled'
);
create type public.requirement_result as enum (
  'current',
  'expiring_soon',
  'expired',
  'missing',
  'wrong_year',
  'unsigned',
  'no_expiry'
);
create type public.access_event_type as enum (
  'code_generated',
  'code_cancelled',
  'pack_viewed',
  'documents_received',
  'changes_requested'
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 2 and 160),
  short_name text not null check (char_length(short_name) between 2 and 40),
  destination_text text not null check (char_length(destination_text) between 2 and 300),
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null default 'individual',
  display_name text not null check (char_length(display_name) between 2 and 100),
  organization_id uuid references public.organizations(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_role_organization_check check (
    (role = 'individual' and organization_id is null)
    or (role = 'staff' and organization_id is not null)
  )
);

create table public.document_types (
  id text primary key check (id ~ '^[a-z0-9_]+$'),
  label text not null check (char_length(label) between 2 and 120),
  default_expiry_method public.expiry_method not null,
  default_duration_months integer,
  requires_year boolean not null default false,
  allows_signed_attestation boolean not null default false,
  created_at timestamptz not null default now(),
  constraint document_types_duration_check check (
    (default_expiry_method = 'duration' and default_duration_months > 0)
    or (default_expiry_method <> 'duration' and default_duration_months is null)
  )
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  document_type_id text not null references public.document_types(id),
  display_name text not null check (char_length(display_name) between 1 and 160),
  original_filename text not null check (
    char_length(original_filename) between 1 and 255
    and original_filename !~ '[/\\]'
  ),
  storage_path text not null unique check (storage_path ~ '^users/[0-9a-f-]+/[0-9a-f-]+/'),
  mime_type text not null check (mime_type in ('application/pdf', 'image/jpeg', 'image/png')),
  size_bytes bigint not null check (size_bytes between 1 and 10485760),
  valid_from date not null,
  expiry_method public.expiry_method not null,
  duration_months integer,
  expires_on date,
  reference_year integer check (reference_year between 2000 and 2100),
  signed_attested boolean not null default false,
  issuer text check (issuer is null or char_length(issuer) <= 160),
  description text check (description is null or char_length(description) <= 500),
  supersedes_document_id uuid references public.documents(id),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint documents_expiry_fields_check check (
    (
      expiry_method = 'duration'
      and duration_months > 0
      and expires_on is not null
      and expires_on >= valid_from
    )
    or (
      expiry_method = 'fixed_date'
      and duration_months is null
      and expires_on is not null
      and expires_on >= valid_from
    )
    or (
      expiry_method = 'none'
      and duration_months is null
      and expires_on is null
    )
  ),
  constraint documents_not_self_superseding check (supersedes_document_id is distinct from id)
);

create index documents_owner_type_active_idx
  on public.documents (owner_id, document_type_id, valid_from desc, created_at desc)
  where deleted_at is null;

create table public.services (
  id text primary key check (id ~ '^[a-z0-9_]+$'),
  organization_id uuid not null references public.organizations(id),
  name text not null check (char_length(name) between 2 and 160),
  description text not null check (char_length(description) between 2 and 500),
  destination_text text not null check (char_length(destination_text) between 2 and 300),
  blank_form_path text check (blank_form_path is null or blank_form_path ~ '^/forms/[a-zA-Z0-9._-]+$'),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.service_requirements (
  id uuid primary key default gen_random_uuid(),
  service_id text not null references public.services(id) on delete cascade,
  document_type_id text not null references public.document_types(id),
  label text not null check (char_length(label) between 2 and 160),
  sort_order integer not null check (sort_order > 0),
  freshness_months integer check (freshness_months > 0),
  required_reference_year integer check (required_reference_year between 2000 and 2100),
  requires_signed_attestation boolean not null default false,
  allows_no_expiry boolean not null default false,
  help_text text not null check (char_length(help_text) between 2 and 500),
  created_at timestamptz not null default now(),
  unique (service_id, document_type_id),
  unique (service_id, sort_order)
);

create table public.service_packs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  service_id text not null references public.services(id),
  status public.pack_status not null default 'draft',
  readiness_percent integer not null default 0 check (readiness_percent between 0 and 100),
  staff_feedback text check (staff_feedback is null or char_length(staff_feedback) between 10 and 500),
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_packs_cancelled_state_check check (
    (status = 'cancelled' and cancelled_at is not null)
    or (status <> 'cancelled' and cancelled_at is null)
  )
);

create unique index service_packs_one_active_service_idx
  on public.service_packs (owner_id, service_id)
  where status not in ('cancelled', 'documents_received');

create table public.service_pack_items (
  id uuid primary key default gen_random_uuid(),
  service_pack_id uuid not null references public.service_packs(id) on delete cascade,
  service_requirement_id uuid not null references public.service_requirements(id),
  document_id uuid references public.documents(id),
  result public.requirement_result not null,
  result_reason text not null check (char_length(result_reason) between 2 and 500),
  satisfied boolean not null,
  evaluated_at timestamptz not null,
  unique (service_pack_id, service_requirement_id)
);

create table public.access_codes (
  id uuid primary key default gen_random_uuid(),
  service_pack_id uuid not null references public.service_packs(id) on delete cascade,
  code_hash text not null check (char_length(code_hash) = 64),
  expires_at timestamptz not null,
  used_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  constraint access_codes_timestamps_check check (
    expires_at > created_at
    and (used_at is null or used_at >= created_at)
    and (cancelled_at is null or cancelled_at >= created_at)
  )
);

create unique index access_codes_one_available_per_pack_idx
  on public.access_codes (service_pack_id)
  where used_at is null and cancelled_at is null;

create index access_codes_hash_idx on public.access_codes (code_hash);

create table public.pack_access_grants (
  id uuid primary key default gen_random_uuid(),
  service_pack_id uuid not null references public.service_packs(id) on delete cascade,
  staff_id uuid not null references public.profiles(id),
  organization_id uuid not null references public.organizations(id),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint pack_access_grants_timestamps_check check (
    expires_at > created_at
    and (revoked_at is null or revoked_at >= created_at)
  )
);

create index pack_access_grants_active_lookup_idx
  on public.pack_access_grants (staff_id, service_pack_id, expires_at)
  where revoked_at is null;

create table public.access_events (
  id uuid primary key default gen_random_uuid(),
  service_pack_id uuid not null references public.service_packs(id) on delete cascade,
  actor_id uuid not null references public.profiles(id),
  event_type public.access_event_type not null,
  organization_id uuid references public.organizations(id),
  document_ids uuid[] not null default '{}',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint access_events_details_object_check check (jsonb_typeof(details) = 'object')
);

create index access_events_pack_created_idx
  on public.access_events (service_pack_id, created_at desc);

create index access_events_actor_created_idx
  on public.access_events (actor_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger documents_set_updated_at
before update on public.documents
for each row execute function public.set_updated_at();

create trigger service_packs_set_updated_at
before update on public.service_packs
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_name text;
begin
  requested_name := trim(coalesce(new.raw_user_meta_data ->> 'display_name', ''));

  insert into public.profiles (id, role, display_name, organization_id)
  values (
    new.id,
    'individual',
    case when char_length(requested_name) between 2 and 100 then requested_name else 'ReqDocs user' end,
    null
  );

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.current_user_organization_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select organization_id from public.profiles where id = auth.uid();
$$;

create or replace function public.is_pack_owner(target_pack_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.service_packs
    where id = target_pack_id and owner_id = auth.uid()
  );
$$;

create or replace function public.has_active_pack_grant(target_pack_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.pack_access_grants grants
    join public.service_packs packs on packs.id = grants.service_pack_id
    join public.services service on service.id = packs.service_id
    where grants.service_pack_id = target_pack_id
      and grants.staff_id = auth.uid()
      and grants.organization_id = public.current_user_organization_id()
      and grants.organization_id = service.organization_id
      and grants.revoked_at is null
      and grants.expires_at > now()
  );
$$;

revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.current_user_role() from public, anon;
revoke all on function public.current_user_organization_id() from public, anon;
revoke all on function public.is_pack_owner(uuid) from public, anon;
revoke all on function public.has_active_pack_grant(uuid) from public, anon;
grant execute on function public.current_user_role() to authenticated;
grant execute on function public.current_user_organization_id() to authenticated;
grant execute on function public.is_pack_owner(uuid) to authenticated;
grant execute on function public.has_active_pack_grant(uuid) to authenticated;

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.document_types enable row level security;
alter table public.documents enable row level security;
alter table public.services enable row level security;
alter table public.service_requirements enable row level security;
alter table public.service_packs enable row level security;
alter table public.service_pack_items enable row level security;
alter table public.access_codes enable row level security;
alter table public.pack_access_grants enable row level security;
alter table public.access_events enable row level security;

revoke all on all tables in schema public from anon, authenticated;

grant select on public.organizations to authenticated;
grant select on public.document_types to authenticated;
grant select on public.services to authenticated;
grant select on public.service_requirements to authenticated;
grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;
-- Demo seeding and other trusted backend maintenance use the service role.
-- RLS bypass alone does not provide the underlying table privileges.
grant select, insert, update on public.profiles to service_role;
grant select, insert, update, delete on public.documents to authenticated;
grant select, insert, update, delete on public.service_packs to authenticated;
grant select, insert, update, delete on public.service_pack_items to authenticated;
grant select on public.pack_access_grants to authenticated;
grant select on public.access_events to authenticated;

create policy organizations_read_authenticated
on public.organizations for select to authenticated
using (auth.uid() is not null);

create policy profiles_read_own
on public.profiles for select to authenticated
using (id = auth.uid());

create policy profiles_update_own_name
on public.profiles for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy document_types_read_authenticated
on public.document_types for select to authenticated
using (auth.uid() is not null);

create policy documents_read_owner_or_granted_staff
on public.documents for select to authenticated
using (
  owner_id = auth.uid()
  or exists (
    select 1
    from public.service_pack_items items
    where items.document_id = documents.id
      and public.has_active_pack_grant(items.service_pack_id)
  )
);

create policy documents_insert_own
on public.documents for insert to authenticated
with check (owner_id = auth.uid() and public.current_user_role() = 'individual');

create policy documents_update_own
on public.documents for update to authenticated
using (owner_id = auth.uid() and public.current_user_role() = 'individual')
with check (owner_id = auth.uid() and public.current_user_role() = 'individual');

create policy documents_delete_own
on public.documents for delete to authenticated
using (owner_id = auth.uid() and public.current_user_role() = 'individual');

create policy services_read_authenticated
on public.services for select to authenticated
using (auth.uid() is not null);

create policy service_requirements_read_authenticated
on public.service_requirements for select to authenticated
using (auth.uid() is not null);

create policy service_packs_read_owner_or_granted_staff
on public.service_packs for select to authenticated
using (owner_id = auth.uid() or public.has_active_pack_grant(id));

create policy service_packs_insert_own
on public.service_packs for insert to authenticated
with check (owner_id = auth.uid() and public.current_user_role() = 'individual');

create policy service_packs_update_own
on public.service_packs for update to authenticated
using (owner_id = auth.uid() and public.current_user_role() = 'individual')
with check (owner_id = auth.uid() and public.current_user_role() = 'individual');

create policy service_packs_delete_own
on public.service_packs for delete to authenticated
using (owner_id = auth.uid() and public.current_user_role() = 'individual');

create policy service_pack_items_read_owner_or_granted_staff
on public.service_pack_items for select to authenticated
using (
  public.is_pack_owner(service_pack_id)
  or public.has_active_pack_grant(service_pack_id)
);

create policy service_pack_items_insert_owner
on public.service_pack_items for insert to authenticated
with check (
  public.is_pack_owner(service_pack_id)
  and public.current_user_role() = 'individual'
);

create policy service_pack_items_update_owner
on public.service_pack_items for update to authenticated
using (
  public.is_pack_owner(service_pack_id)
  and public.current_user_role() = 'individual'
)
with check (
  public.is_pack_owner(service_pack_id)
  and public.current_user_role() = 'individual'
);

create policy service_pack_items_delete_owner
on public.service_pack_items for delete to authenticated
using (
  public.is_pack_owner(service_pack_id)
  and public.current_user_role() = 'individual'
);

create policy access_codes_read_owner
on public.access_codes for select to authenticated
using (public.is_pack_owner(service_pack_id));

create policy pack_access_grants_read_current_staff
on public.pack_access_grants for select to authenticated
using (
  staff_id = auth.uid()
  and organization_id = public.current_user_organization_id()
);

create policy access_events_read_owner_or_actor
on public.access_events for select to authenticated
using (public.is_pack_owner(service_pack_id) or actor_id = auth.uid());
