# PermitAIO — All in One Permitting

Multi-tenant SaaS for windows/roofing contractors that unifies floor plans, permit
inventory, and HOA tracking under a shared Job number.

## Tech stack

- **Next.js 15** (App Router) + TypeScript + Tailwind + shadcn/ui
- **Supabase** (Auth + Postgres + Storage + Row Level Security)
- Deployed to **Vercel**

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

Create `.env.local` in the project root (never commit this file — it's already
git-ignored):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-publishable-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>

# Billing (Stripe) — required for the /billing checkout flow and
# subscription-status webhooks. Use test-mode keys (sk_test_...) until
# you're ready to charge real cards, then switch to live-mode keys.
STRIPE_SECRET_KEY=<your-stripe-secret-key>
STRIPE_WEBHOOK_SECRET=<your-stripe-webhook-signing-secret>

# Base URL used to build Stripe Checkout success/cancel redirect URLs when
# the request origin can't be trusted (falls back to the request's own
# origin if unset).
NEXT_PUBLIC_APP_URL=https://permitaio.com
```

Get the Supabase values from your Supabase project's **Settings → API** page
(the service role key is under "Project API keys" — keep it server-side only,
never expose it with a `NEXT_PUBLIC_` prefix).

Get the Stripe values from the [Stripe Dashboard](https://dashboard.stripe.com/test/apikeys):
`STRIPE_SECRET_KEY` from **Developers → API keys**, and `STRIPE_WEBHOOK_SECRET`
after creating a webhook endpoint at **Developers → Webhooks** pointed at
`https://permitaio.com/api/webhooks/stripe` (or your preview URL) listening
for `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`,
`customer.subscription.updated`, and `customer.subscription.deleted`.

### Pricing model

Organizations get a 14-day free trial (`trial_ends_at` on the `organizations`
row) with full platform access. After the trial, `/billing` requires an
owner/admin to pick:

- **A monthly subscription** — Essential $299, Priority $399, or Concierge $750
- **A one-time onboarding package** — Self-Serve $499, Standard $999, or
  White-Glove $1,999

Both are combined into a single Stripe Checkout Session (`mode: "subscription"`
with two line items) so the customer pays the onboarding fee + first month
together, then just the monthly fee going forward. Tier definitions and copy
live in `src/lib/marketing/pricing.ts`; Stripe price IDs are configured there
and must match real Price objects in your Stripe account.

## Database

The `supabase/` folder contains the full schema history, in order:

| File | Purpose |
|---|---|
| `schema.sql` | Base multi-tenant schema: organizations, organization_members, jobs, stages, and related tables, with RLS policies |
| `01_contractor_profiles_and_form_metadata.sql` | Contractor profiles + form doc-type/trade/field-mapping tables |
| `02_template_tables_and_hook.sql` | Template reference tables (`template_hoas`, `template_product_approvals`, `template_requirements_forms`) + the `handle_new_organization` trigger that auto-seeds every new org |
| `03_fix_org_creation_rls.sql` | Fixes the org-creation RLS bug — see below |
| `seed_folio_codes.sql`, `seed_template_*.sql` | One-time seed data loads (545 HOAs, 25 product approvals, 6 requirements forms) into the `template_*` tables |
| `04`–`10` | Incremental app features: HOA/job assignment fields, manager role, form templates + county/trade filtering, storage RLS scoping, permit application details, user profiles |
| `11_billing_columns.sql` | Billing columns on `organizations`: `trial_ends_at`, `subscription_status`, `subscription_tier`, `onboarding_tier`, `onboarding_paid`, `stripe_customer_id`, `stripe_subscription_id`, `stripe_checkout_session_id` |
| `12_platform_admins.sql` | `platform_admins` table (self-select-only RLS) that gates the `/admin` owner console |

### How org creation works

When a user creates an organization, a `SECURITY DEFINER` trigger
(`handle_new_organization`) automatically:

1. Inserts the creator into `organization_members` with role `owner`
2. Seeds 22 default pipeline stages into `stages`
3. Copies the template reference data (HOAs, product approvals, requirements
   forms) from the `template_*` tables into that org's own tables

This means the client only ever needs to `INSERT` a single row into
`organizations` — everything else happens server-side, atomically, inside the
trigger. See `03_fix_org_creation_rls.sql` for the history of why this needed
a `SECURITY DEFINER` fix and an RLS policy change (Postgres re-checks the
`SELECT` policy for a `RETURNING` clause using the row's state as of that
statement, before an `AFTER INSERT` trigger's side effects on *other* tables
are visible to that same projection — so the org's SELECT policy also allows
`created_by = auth.uid()` directly, not only membership).

### Applying migrations to a fresh project

Run the files in `supabase/` in the order listed above via the Supabase SQL
editor or `supabase db push` with the Supabase CLI.

## Owner console

`/admin` is a cross-tenant dashboard for the platform owner — KPI cards
(organization count, trial/active/past-due/canceled counts, MRR, one-time
onboarding revenue collected) plus a sortable table of every organization
(owner, status, trial countdown, subscription tier, onboarding tier, member
count, job count, sign-up date).

- Gated by the `platform_admins` table, not a role on `organizations` — a
  user must have a row in `platform_admins` to see the "Owner console" link
  in the account menu and to load `/admin` (everyone else is redirected to
  `/dashboard`).
- Reads across every org with the Supabase service-role client, so it needs
  `SUPABASE_SERVICE_ROLE_KEY` configured in the environment. Without it, the
  page renders a setup banner instead of crashing.
- To grant access, insert a row into `platform_admins` for the user's
  `auth.users.id` via the Supabase SQL editor — there's no self-serve UI for
  this on purpose.

## Team invites

Org owners and admins can invite teammates by email from **Settings → Team**
(`Invite member` button). The flow is:

1. Owner/admin picks an email + role (`admin`, `manager`, or `member`) — the
   server action (`inviteMember` in `src/lib/actions/invites.ts`) blocks
   self-invites and invites to someone already in the org, then inserts a row
   into `organization_invites` (`13_organization_invites.sql`) and, if
   `SUPABASE_SERVICE_ROLE_KEY` is configured, sends a real Supabase Auth
   invite email via `admin.inviteUserByEmail`. Without the service-role key,
   the invite row is still created (so it's ready to accept) but no email
   goes out — the UI shows a note to that effect.
2. **Existing PermitAIO users** who are invited see a pending-invite banner
   at the top of `/dashboard` (`pending-invites-banner.tsx`) the next time
   they load the app, with Accept/Decline actions.
3. **Brand-new users** click the emailed link, land on `/invite/accept`,
   set a password, and are signed in. A `SECURITY DEFINER` trigger,
   `handle_invited_user_signup()` (fires `AFTER INSERT ON auth.users`),
   automatically joins them to every org with a matching pending invite by
   email and marks those invites accepted — no manual accept step needed for
   first-time signups.
4. Accepting sets the `permitaio_active_org` cookie to the newly-joined
   org's slug so the workspace switcher lands the user there immediately.

`14_invited_users_can_read_org.sql` adds a narrow RLS policy so an invited
person (not yet an org member) can read the name/slug of the org they were
invited to — needed both for the banner to show the real org name and for
accept to resolve the slug to switch into. The default "members can read
their org" policy alone can't cover this, since by definition an invitee
isn't a member until they accept.

## Deployment

Push to `main` on GitHub; Vercel is connected via Git integration and deploys
automatically. Set all the environment variables above in the Vercel project
settings (Production, Preview, and Development environments) — the app will
build without the Stripe/service-role keys, but billing, the Stripe webhook,
and the owner console will fail (or show a setup banner) at request time
until they're added.

## Project structure

```
src/
  app/
    (auth)/          signup, login
    (app)/           authenticated app shell — dashboard, contractors, settings, jobs
  lib/
    actions/         Next.js server actions (auth, orgs)
    data/            server-side data-fetching helpers
    supabase/        Supabase client factories + generated DB types
supabase/            SQL schema, migrations, and seed data (see above)
```
