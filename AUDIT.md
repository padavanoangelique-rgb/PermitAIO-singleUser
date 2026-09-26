# PermitAIO Audit — Aug 30, 2026

Working from the live repo `permitaio.com` (Vercel), Supabase project `tibyupxfosgnyrohruof`, and the commit history since the 7/10 rating (49 commits total, latest `47cd6be`).

Written for handoff to Claude Code so a fresh set of eyes can pick up where I left off. Not a marketing pitch — the score I give at the bottom is honest.

---

## What the platform does today

PermitAIO is a multi-org SaaS that generates complete permit packages for South Florida window/door and roofing contractors:

- **Permit Inventory** — per-job source of truth for county, jurisdiction, folio, address, city, floor area
- **Forms Generator** — auto-picks the county-wide + jurisdiction-specific PDF forms that apply, fills them from job/contractor/permit data, and packages the whole thing in a ZIP (Permit App, NOC, addendums, checklists, product approvals, floor plan, W&D schedule, fenestration chart)
- **NOA Library** — cross-org shared source of truth for FL product approvals and NOAs
- **Requirements & Forms Library** — cross-org shared jurisdiction requirements + form links
- **HOA Tracker** — South Florida association DB with ARC form links
- **Floor Plan Tool** — measures window openings, computes floor area, generates the window/door schedule
- **Owner Console (`/admin`)** — platform-admin-only management of the universal form/NOA/R&F libraries

## Current scale

| Metric | Value |
|---|---|
| TypeScript / TSX files | 200 |
| Lines of code | 28,316 |
| App routes | 25 (14 in `(app)`, 4 admin, 4 auth, 4 API) |
| Component modules | 15 domain folders |
| Lib modules | 12 domain folders |
| Git commits since v1 | 49 |
| Orgs live | 3 (Majestic, Guardian, Premier) |
| Jobs in production | 459 |
| Platform-shared form templates | 13 (Broward, Miami-Dade, Palm Beach) |
| Counties covered | 3 of 5 target counties |

## Tech stack

- **Framework** — Next.js 15.5.23 (App Router) + React 19.1.0
- **Language** — TypeScript strict mode
- **Auth + DB** — Supabase (RLS on every table, org-scoped policies)
- **Payments** — Stripe 22.5.0 (subscription + one-time onboarding, promo codes, portal, webhook)
- **UI** — shadcn/ui + Radix + Base UI + Tailwind 4 (custom PermitAIO palette)
- **PDF** — pdf-lib (form filling, appearance baking)
- **Fonts** — Satoshi + General Sans (via CDN)
- **Deploy** — Vercel (production `permitaio.com`)
- **Repo** — `github.com/padavanoangelique-rgb/permitaio`

---

## What shipped since the 7/10 rating

Ordered oldest → newest (of the improvements pushed in this session series):

### Design & UX
1. **Sidebar Requirements & Forms** — split-pane library, no more flat list (`498b200`)
2. **Requirements & Forms panel** — larger detail font, inset layout, nested city groups, job-lock (`08f9d95`, `078fd66`)
3. **Floor-plan tool** — matched app header/tabs, removed "EZ Permit Builder" title (`5c6c945`, `7ab0b78`)
4. **Permit checklist PDF** — added openings + sq ft summary; fixed heading overlap (`affdaa2`, `a4be97c`)
5. **Owner-only `/admin/forms`** — role-gated ownership console (`7441c01`)
6. **Clickable Jobs KPIs** — dashboard tiles now filter the jobs list

### Integration & correctness (this session)
7. **County/Jurisdiction split** on Inventory — county fills permit apps (required), jurisdiction picks which forms apply (`598d286`)
8. **Permit App Info** — dropped 6 always-N/A fields, auto-filled floor area from floor plan, Building Use = Condo/SFR select only (`0e5a66e`)
9. **Forms Generator card** — made read-only, Inventory is the single source of truth (`ef02153`)
10. **Inventory row** — County selection now holds via `countyDraft` state, unlocks Jurisdiction dropdown (`323aa4e`)
11. **Preflight split** — Permit Package split County + Jurisdiction into two separate rows with clearer messaging (`5727a04`)
12. **`guessCountyFromText` fix** — strip " County" suffix so `countyOf("Sunrise")` = "Broward County" resolves back to `"Broward"` (`a9fc7f6`)
13. **Debug fill-values dump** — ZIP now contains `DEBUG_READ_ME.json` showing exactly what `fillPdfForm` received (`e3c457a`, `dd0b775`)
14. **Trade normalization** — `windows_doors` == `windows` in the matcher, so Coral Springs / Miramar / Pembroke Pines / Plantation templates finally apply (`dd0b775`)
15. **Jurisdiction-name matching** — matcher now uses `jurisdiction_name` (source of truth) instead of the mostly-null `jurisdiction_code`; canonicalization strips parentheticals, diacritics, and " County" suffix so "Miami-Dade" matches "Miami-Dade County (unincorporated + cities…)". 7/7 automated test cases pass covering Broward, Palm Beach, and Miami-Dade unincorporated + city-specific rules (`47cd6be`)

### Data model
- `contractor_profiles` — full FL contractor structure (license, qualifier, BTR, phone/email/address, is_default, trade)
- `job_permit_details` — deep permit metadata separate from `jobs`
- `form_templates` — platform vs org visibility, PDF blob + field_mapping JSON
- `hoa_associations` — 27-field HOA record with ARC form URLs
- Stripe columns on `organizations` — `stripe_customer_id`, `stripe_subscription_id`, `subscription_status`, `subscription_tier`, `billing_interval`, `plan`, `stripe_checkout_session_id`

---

## What's actually great

1. **Universal, not per-org.** The forms/NOA/R&F library is one row per template — all orgs see it, RLS reads by `visibility='platform'`. No hardcoded orgs, no data duplication.
2. **RLS everywhere.** Every table has `is_org_member(org_id)` policies. `form_templates` layers platform vs org visibility correctly. Platform admin gets an override path for the shared library.
3. **Stripe scaffold is production-grade.** Live + test price ID switching, mixed one-time + recurring line items in one Checkout Session, typed promo codes with real Stripe Coupons, org-scoped customers, webhook handler for `checkout.session.completed` / `customer.subscription.updated` / `customer.subscription.deleted` / `invoice.payment_failed`, DB updates on every event. All the wiring is there — you just need to flip live keys and set the webhook secret.
4. **Type safety.** Strict TS, `noEmit` compilation clean on every commit, no `any` cheats in the fill/matcher paths.
5. **Design system.** Real palette (light: white/black + blue accent; dark: black/white + lime-green accent), real font pairing (Satoshi + General Sans), shadcn/ui + Radix + Base UI, custom radius scale from `sm` to `4xl`.
6. **Testable matcher.** The form-picking rules now have a 7-case regression suite covering every county rule you specified today.
7. **Debug-friendly.** ZIPs contain `DEBUG_READ_ME.json` when there's a fill problem; error messages surface the real cause instead of "missing forms".

## What still needs work

Numbered so Claude Code can attack them in order. Grouped by severity.

### CRITICAL — blocks 10/10

1. **Blank PDF fill bug (unresolved).**
   Alba Diaz's Broward Permit App downloaded with 106 fields and zero values set. The client-side call to `fillPdfForm` isn't running setText. My proof-of-concept fill (`test-appearance.mjs`) fills the same template correctly in Node, so the bug is upstream — either the `values` object is empty in the browser, or every `form.getField(name)` throws and is silently swallowed. The `DEBUG_READ_ME.json` I added will pinpoint it on the next generation (needs hard refresh Cmd-Shift-R). **Fix path:** inspect the debug JSON, then either (a) fix data flow if values are empty, or (b) replace the silent try/catch in `pdf-fill.ts:147-151` with loud per-field error surfacing.

2. **Miami-Dade city templates.**
   The DB has one Miami-Dade permit app (unincorporated). Miami-Dade has 34 cities, most with their own permit app (Aventura, Miami Beach, Coral Gables, Doral, Hialeah, etc.). Same for Palm Beach — only Boynton Beach has a city-specific affidavit. **Fix path:** bulk-upload city permit apps + build a mapping UI so you can add them without editing SQL.

3. **Admin field-mapping UI.**
   `/admin/forms` uploads templates but there's no in-browser way to map PDF fields to JobData keys — you'd have to edit `field_mapping` JSON in Supabase directly. **Fix path:** build a "Detect Fields" button that reads AcroForm names via pdf-lib in the browser and a mapping editor that lets you pick a JobData key per field from a dropdown.

### HIGH — needed for confident scaling

4. **Design polish pass — the 7 → 9 lift.**
   - Empty states — most tables (Jobs, Contractors, Floor Plans, HOA) show nothing helpful when empty; needs illustrated empty state + primary action
   - Loading states — currently `null` or skeleton-less on data fetches; add shadcn Skeleton to KPI tiles, inventory rows, forms list
   - Toasts — inconsistent (some `toast.success`, some silent, some throw); pick one library-wide pattern
   - Error surfaces — 404s land on default Next.js page; add branded `error.tsx` and `not-found.tsx`
   - Motion — no page transitions, no button ripples, no card lift on hover; add subtle Framer Motion (page fade 200ms, card hover translate-y-[-2px])
   - Density — tables are info-dense but the padding is inconsistent; sweep to a single 8px/12px/16px system

5. **Onboarding.**
   `src/app/onboarding/` exists but is thin. New orgs land in an empty dashboard with no guided path. Needs a 3-step onboard: (1) add default contractor, (2) upload floor-plan sample, (3) generate first permit package.

6. **Multi-user + role UI.**
   `organization_members` supports owner/admin/manager/member roles but there's no invite UI in Settings, no member list, no role editor. **Fix path:** add `/settings/team` with invite flow (email → Supabase Auth invite → membership row).

7. **Audit log.**
   For a compliance-sensitive product (permits), there's no `audit_log` table. Should record who generated what package for which job with a timestamp — used for troubleshooting and for evidence in the rare AHJ dispute.

### MEDIUM — should ship but not blocking

8. **Search across everything.** No global cmd-K. Add a spotlight-style search over jobs, HOAs, NOAs, forms, contractors.
9. **Bulk operations.** Can't multi-select jobs and generate ZIPs in batch. Can't bulk-import contractors from CSV.
10. **Test coverage.** Only the matcher has automated tests. Add unit tests for `folio.ts`, `pdf-fill.ts`, `codeForJurisdiction`, and integration tests for the ZIP-generation flow.
11. **Mobile.** Sidebar collapses but the inventory row and forms panel are horizontal-scroll disasters on phones. Field techs will want mobile.

### LOW — polish

12. **PDF preview.** Show a first-page thumbnail of each form in the ZIP before generation.
13. **Version pinning per jurisdiction.** Fenestration Chart may change year-to-year — schema needs an `effective_from` / `effective_to` on templates.
14. **Public marketing site.** `/pricing` is the only marketing-flavored page. Homepage still shows the app.

---

## Stripe integration — what's done, what's left

### Already implemented (real code, not scaffolding)

- **DB layer** — `organizations.stripe_customer_id`, `stripe_subscription_id`, `stripe_checkout_session_id`, `subscription_status`, `subscription_tier`, `billing_interval`, `plan`
- **`/api/billing/checkout`** — creates Stripe Customer if missing, combines subscription + one-time onboarding fee in one Checkout Session (`mode: "subscription"` with mixed line items), applies promo coupons, stores session ID
- **`/api/webhooks/stripe`** — signature-verified handler for `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`; updates org state per event
- **`/pricing`** — 3 tiers (Essential / Priority / Concierge) + 3 onboarding options (Self-Serve / Standard / White-Glove), monthly/annual toggle
- **`/billing`** — current-plan display + "Manage subscription" (Stripe Customer Portal) button
- **Pricing config** — `src/lib/marketing/pricing.ts` — live/test price IDs, 4 promo codes with real Stripe Coupons

### What you still need to do (mostly external config, tiny code deltas)

**Config (Vercel env vars):**
```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...           # set once you create the live webhook
NEXT_PUBLIC_SUPABASE_URL=...              # already set
NEXT_PUBLIC_SUPABASE_ANON_KEY=...         # already set
SUPABASE_SERVICE_ROLE_KEY=...             # already set
RESEND_API_KEY=...                        # already set
PLATFORM_OWNER_EMAIL=padavano.angelique@gmail.com
```

**Stripe dashboard:**
1. Create the 3 subscription Products in live mode (Essential $199/mo, Priority $399/mo, Concierge $799/mo — pick your numbers)
2. Create the 3 onboarding Products (Self-Serve $0, Standard $499, White-Glove $1,499 one-time — pick your numbers)
3. Copy the live Price IDs into `PRICE_IDS.*.live` in `src/lib/marketing/pricing.ts`
4. Create annual Prices for the 3 subscription tiers (~17% off) — fill `ANNUAL_PRICE_IDS.*.live`
5. Create the 4 Coupons (WELCOME15, SETUPFREE, ALLFREE, HALFOFF50) — fill `PROMO_CODES.*.coupon.live`
6. Add webhook endpoint: `https://permitaio.com/api/webhooks/stripe` — subscribe to `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`. Copy signing secret to `STRIPE_WEBHOOK_SECRET`.

**Code deltas (small, all clearly marked):**
1. **Trial period** — add `trial_period_days: 14` to the `subscription_data` in `checkout/route.ts:118` if you want a free trial
2. **Feature gating** — add a `hasActiveSubscription(org)` helper reading `organizations.subscription_status IN ('active','trialing')` and gate `/inventory`, `/jobs/[id]/permit-package` behind it (currently everything works regardless of plan)
3. **Usage metering** — if you plan to tier by permits/month, add a `usage_records` table + counter increment on each ZIP generation; enforce cap in `/api/permit-package/build`
4. **Failed-payment grace period** — the `invoice.payment_failed` webhook logs but doesn't downgrade — add a 7-day grace window before flipping status to `past_due` in the UI
5. **Success page** — `/billing?checkout=success` should show a confirmation card + next-action CTA (currently just re-renders the billing page)

**Estimated time to production-live Stripe:** 3-4 hours of your + Claude Code's work, mostly Stripe dashboard clicks and the 5 code deltas above.

---

## Score against the 10/10 rubric

Same rubric I used for the 7/10 rating:

| Category | Weight | Last | Now | Δ | Notes |
|---|---|---|---|---|---|
| **Correctness** — does the core flow work end-to-end? | 25% | 6 | 7 | +1 | Preflight, matcher, jurisdiction rules all fixed. Blank-fill bug is the last blocker. Once that's dead this jumps to 9. |
| **Design & polish** — does it look like a $199/mo product? | 20% | 6 | 7 | +1 | Sidebar Requirements, admin console, PDF layout fixes shipped. Empty states, motion, loading states still missing. |
| **Data model & RLS** — is the schema sane and secure? | 15% | 9 | 9 | 0 | Was already great. Adding audit_log + version pinning gets it to 10. |
| **Admin power** — can you run this without SQL? | 15% | 4 | 7 | +3 | `/admin/forms` exists and works for uploads. Field-mapping UI is the remaining gap (still needs Supabase SQL for now). |
| **Integration** — does data flow between areas cleanly? | 10% | 6 | 8 | +2 | Inventory → Forms is now single-source. Floor plan → floor area auto-fill lands. Contractor auto-pick works. |
| **Multi-tenancy & billing** | 10% | 6 | 7 | +1 | Stripe scaffold ready to flip on. Team invites still missing. |
| **Testing & ops** | 5% | 3 | 5 | +2 | Matcher has 7 automated tests. No CI, no e2e. |

**Overall: 7 → 7.6.** Rounded to the same integer bucket. Feels stuck because the flagship generator flow still has an unresolved blocker (blank PDFs) and the design polish pass hasn't happened yet.

### The honest path to 10

- **7.6 → 8.5** (1 week): Kill the blank-fill bug (done in <1 hour once you send the debug JSON), ship the design polish sweep, add empty states, add motion, add loading skeletons.
- **8.5 → 9.3** (2 weeks): Ship the admin field-mapping UI + bulk Miami-Dade / Palm Beach city permit apps, add onboarding, add team invites, wire feature gating behind Stripe subscription status.
- **9.3 → 10** (1 month): Cmd-K global search, mobile pass, audit log, e2e tests, marketing site.

**All of the above is knowable, scoped, and unblocked.** Nothing on this list requires a rewrite or an architecture change. The foundation is sound — it's just execution from here.

---

## For Claude Code — where to start

Priority order for the next session:

1. **Read `DEBUG_READ_ME.json`** from a freshly generated Alba Diaz ZIP (Angelique will provide) — that pinpoints the blank-fill bug in <5 min
2. **Fix the blank-fill bug** — either data-flow fix or replace silent catch in `src/lib/forms/pdf-fill.ts:147-151` with loud per-field failure
3. **Build `/admin/forms` field-mapping UI** — button "Detect Fields" that reads AcroForm names, table with PDF field name → JobData key dropdown
4. **Bulk-upload Miami-Dade + Palm Beach city permit apps** — 10-15 uploads, use the new mapping UI
5. **Design polish sweep** — empty states, skeletons, toasts, motion
6. **Flip Stripe to live** — create Prices + Coupons in Stripe dashboard, set env vars, test one real checkout end-to-end
7. **Feature gate** — `hasActiveSubscription` helper + gate `/inventory` and permit generation behind it

Key files:
- `src/lib/forms/match.ts` — form-picking rules (has tests)
- `src/lib/forms/pdf-fill.ts` — the AcroForm filler (silent catch on line 147 is the current bug suspect)
- `src/lib/permit-package/build.ts` — ZIP orchestrator, dumps DEBUG_READ_ME.json
- `src/app/api/billing/checkout/route.ts` — Stripe Checkout Session creator
- `src/app/api/webhooks/stripe/route.ts` — Stripe webhook handler
- `src/lib/marketing/pricing.ts` — price ID + coupon config (needs live IDs filled in)

Standing rules from Angelique (never violate):
- Commits authored as `padavano.angelique@gmail.com` / `Angelique Padavano`
- No per-org hardcoding — universal fixes only
- Forms Library + NOA Library + R&F Library are cross-org platform-visibility
- County = fills permit application PDF (required field). Jurisdiction = picks which city-specific forms apply.
- Contractor should auto-fill (org default) — no picker
- Inventory is source of truth for County + Jurisdiction + Address + Folio + City + Floor Area
- Building Use = exactly "Condominium" or "Single Family Residence"
- Flood Zone / BFE / Construction Type / Occupancy Group = always "N/A"

---

Written by Perplexity Computer for Angelique Padavano, Aug 30, 2026. See git log for full change history.
