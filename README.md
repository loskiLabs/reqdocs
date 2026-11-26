# ReqDocs

ReqDocs is a mobile-first application that helps people prepare current
documents for a service and share only one consented Service Pack with
authorised staff.

The detailed product and engineering specifications live in
[`ReqDocs/`](ReqDocs/README.md).

## Local setup

Requirements: Node.js 24 and npm 11 or newer.

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` and add your Supabase values.
3. Apply the SQL migrations in `supabase/migrations/` to your Supabase project.
4. Follow [`supabase/README.md`](supabase/README.md) to create the fictional demo accounts.
5. Start the application with `npm run dev`.
6. Open `http://localhost:3000`.

The landing page, `/login`, `/register`, `/staff/login` and `/health` work
without Supabase credentials. Submitting valid credentials and opening protected
workspaces require a configured project.

Public registration always creates an `individual`. Staff users can only be
created by the environment-driven `npm run seed:demo-users` setup command.

Signed-in individuals can open `/vault` to upload fictional PDF, JPG or PNG
files up to 10 MB. Personal files are private; previews use short-lived signed
URLs and no permanent Storage URL is saved or displayed.

Individuals can prepare either of the two MVP Service Packs under `/packs`,
download the supplied blank forms, fix incomplete requirements from inside the
pack and share the exact ready document list with a six-digit code. Matching
organisation staff redeem the code under `/staff`, receive 15 minutes of
pack-only access and can record **Documents received for processing** or request
specific changes. Individuals can review those events under `/history`.

`.env.example` is the safe, committed list of configuration names. `.env.local`
contains the real local values, is loaded automatically by Next.js, and is
intentionally excluded by `.gitignore` so credentials never enter the repo.

## Checks

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:e2e
npm run test:rls
npm run test:sharing
```

`test:rls` requires the configured hosted/local Supabase environment and creates
only temporary fictional records that it removes before exiting. The other
checks can run without mutating the database, except the configured Vault E2E
journey, which uploads and then soft-deletes its fictional test document.
`test:sharing` creates temporary fictional accounts and verifies cancelled,
expired, reused, wrong-organisation and concurrent code redemption, then removes
the accounts. It requires migrations through `20260822007000`.

To create the prepared judging data after seeding accounts:

```bash
npm run seed:demo-journey
```

This adds only fictional files and produces an incomplete UJ pack plus a ready
vehicle-renewal pack. See [DEPLOYMENT.md](DEPLOYMENT.md) for the production
checklist.

Playwright browsers can be installed with `npx playwright install chromium`.

## Privacy

Only fictional demo documents may be used. Blank service forms are public in
`public/forms/`; personal uploads belong in the private Supabase `documents`
bucket and must never be committed.
