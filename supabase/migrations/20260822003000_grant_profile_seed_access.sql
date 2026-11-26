-- Newer Supabase projects may not grant public-schema table privileges to
-- service_role by default. The demo seed script needs these privileges to
-- find and upsert the profile associated with each Auth user.
grant select, insert, update on public.profiles to service_role;
