# Supabase setup

The migrations are ordered and can be applied with the Supabase CLI or through
the SQL editor of a development Supabase project.

When this repository adds a migration after your hosted project was first set
up, run only the new files in timestamp order. Existing hosted projects should
currently apply:

```text
20260822003000_grant_profile_seed_access.sql
20260822004000_grant_document_backend_access.sql
20260822005000_service_pack_engine.sql
20260822006000_access_codes_and_staff_grants.sql
20260822007000_outcomes_and_history.sql
```

Apply every file in that order. The newer migrations move pack calculations to
trusted database transactions, hide code hashes from clients, add atomic
single-use redemption and add grant-scoped staff outcomes.

## Local CLI workflow

1. Install Docker Desktop and the Supabase CLI.
2. Run `supabase start` from the repository root.
3. Run `supabase db reset` to apply the migrations and service-definition seed.
4. Copy the local API URL, anon key and service-role key into `.env.local`.
5. Add three fictional demo passwords to the matching `DEMO_*_PASSWORD`
   variables in `.env.local`.
6. Run `npm run seed:demo-users`.
7. Run `npm run test:rls` to perform an isolated live ownership check with two
   temporary fictional accounts. The script removes both accounts afterward.
8. Run `npm run test:sharing` to verify code expiry, cancellation, reuse,
   organisation scope and concurrent redemption.
9. Run `npm run seed:demo-journey` to create the deterministic fictional judging
   state.

The user seed script creates or updates these fictional accounts without
committing their passwords:

- `demo.user@reqdocs.test`
- `finance.staff@reqdocs.test`
- `licensing.staff@reqdocs.test`

Public sign-up is enabled for individuals. The database trigger always assigns
new public accounts the `individual` role and ignores role or organisation data
sent by a client. Only the service-role seed script assigns staff membership.

For a hosted demo project, disable email confirmation so a judge can complete
registration and reach the dashboard immediately. Production deployments should
choose an email-verification policy deliberately before accepting real users.

After applying migrations in the hosted SQL editor, wait briefly for the API
schema cache to refresh before running the live checks. Do not paste `.env.local`
or any service-role/access-code secret into the SQL editor.
