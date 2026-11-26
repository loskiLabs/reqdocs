# ReqDocs deployment checklist

## Supabase

1. Use a dedicated production/demo Supabase project containing fictional data only.
2. Apply every SQL file in `supabase/migrations/` in filename order.
3. Confirm the `documents` bucket is private and limited to PDF/JPEG/PNG files of at most 10 MB.
4. Configure email/password authentication, the production Site URL and exact Vercel redirect URL. Keep staff registration unavailable.
5. Set strong, different demo passwords locally and run:

   ```bash
   npm run seed:demo-users
   npm run seed:demo-journey
   npm run test:rls
   npm run test:sharing
   ```

## Vercel

Import the GitHub repository as a Next.js project. Add these encrypted environment variables for Production and Preview; never commit their values:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ACCESS_CODE_SECRET
DEMO_INDIVIDUAL_PASSWORD
DEMO_UJ_STAFF_PASSWORD
DEMO_VEHICLE_STAFF_PASSWORD
```

Use a random `ACCESS_CODE_SECRET` of at least 32 characters. Deploy from the repository root with the default Next.js build command. Vercel provides HTTPS.

## Clean-browser release gate

1. Open the HTTPS URL in a private browser and test registration.
2. Test the individual, UJ staff and vehicle staff logins.
3. Run the complete bursary sharing journey and open both case-sensitive blank form URLs.
4. Confirm no real personal information is in database rows or Storage.
5. Run `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build` and `npm run test:e2e` against the production-compatible configuration.
6. Put the final URL and demo passwords in a private judging handoff. Do not add passwords to this repository.
