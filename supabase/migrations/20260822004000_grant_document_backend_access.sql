-- Trusted server code checks whether a document is included in a currently
-- active staff grant before allowing replacement or soft deletion.
grant select on public.pack_access_grants to service_role;
