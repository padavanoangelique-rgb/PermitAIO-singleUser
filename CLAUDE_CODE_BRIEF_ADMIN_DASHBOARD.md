# PermitAIO — Admin dashboard build brief

Working dir: `/Users/angeliquepadavano/permitaio` (or wherever your local checkout lives)
Repo: `git@github.com:padavanoangelique-rgb/permitaio.git`
Live: https://permitaio.com

## What Angelique wants

The Owner Console at `/admin` must be a single place to:

1. **Manage trials & comps** on any org (extend trial, mark comped, un-comp, cancel).
2. **Invite users** to any org from admin (not just from inside that org).
3. **Manage the NOA library** — add / edit / delete rows in the platform-visible NOA catalog that every org sees.
4. **Manage the Forms library** — add / edit / delete rows in the platform-visible forms catalog (permit applications, NOCs, etc.) that every org sees.

Everything scoped as **platform-wide** (not per-org). Only users in `platform_admins` can reach these pages — this is already enforced by `requirePlatformAdmin()` in `src/app/admin/layout.tsx`.

## What already exists (don't rebuild)

- `/admin` — Overview: org table, MRR strip, onboarding revenue. Read-only.
- `/admin/users` — All users table with a platform-admin toggle badge.
- `/admin/forms` — Platform-forms manager (upload / edit / delete). This already handles CRUD for the shared Forms library — verify it works end-to-end and don't rebuild it.
- `src/lib/actions/platform-forms.ts` — upload / update / delete server actions, all gated by `requirePlatformAdmin()` and using `createAdminClient()`. Reuse.
- `src/lib/actions/noa.ts` — has `saveNoaEntry` / `deleteNoaEntry` with a `visibility: "platform" | "org"` field. Platform admins can write platform rows. Reuse — do not create a parallel action file.
- `src/lib/actions/invites.ts` — org-scoped invite flow (owner/admin invites teammate within their org). We'll wrap this for cross-org platform-admin invites.
- `src/lib/data/platform-admin.ts` — `requirePlatformAdmin`, `isPlatformAdmin`, `getAdminOverview` returning per-org rows with `subscription_status`, `trial_ends_at`, `subscription_tier`, `onboarding_tier`, `onboarding_paid`, `member_count`, `job_count`, `owner_email`. Reuse; extend if needed.
- `src/app/admin/admin-tabs.tsx` — tab bar. Add new tabs here.
- `src/lib/supabase/admin.ts` — `createAdminClient()` service-role client. Only use inside server actions/data readers that are already gated by `requirePlatformAdmin()`.

## What to build

Add **three** new tabs to `/admin`: `Trials & Billing`, `NOA Library`, and an **Org actions** column on the existing Overview (or a dedicated `Orgs` tab if it gets too dense). Confirm the existing `/admin/forms` still works and add a delete-confirmation dialog if it lacks one.

### Standing rules (from Angelique — verbatim)

- Commits MUST be authored as `padavano.angelique@gmail.com` / `Angelique Padavano`.
- This chat/project is only for PermitAIO.
- **NO per-org hardcoding.** Universal fixes only.
- Only Angelique / platform admins can delete/change platform data.
- Owner console `/admin` sections must include: Forms + R&F + NOA (R&F = Requirements & Forms, if that exists already keep it — otherwise ignore).
- Window/door + roofing forms only.
- **Think clearly about the issue before executing.**
- Every edit must typecheck (`npx tsc --noEmit`) and lint (`npx eslint src/`) clean before commit.

---

## Task 1 — `/admin/trials` tab (trials, comps, invites)

**New route:** `src/app/admin/trials/page.tsx`
**New client component:** `src/app/admin/trials/trials-table.tsx`

Table: one row per org. Columns:

| Org | Owner | Status | Trial ends | Plan | Actions |
|---|---|---|---|---|---|

Actions column has a small dropdown menu (`DropdownMenu` from `src/components/ui/dropdown-menu.tsx`) with:

- **Extend trial by 14 / 30 / 60 days** — sets `trial_ends_at = greatest(trial_ends_at, now()) + N days`. If org isn't trialing, first flip `subscription_status='trialing'` and set `trial_ends_at`.
- **Comp org (free forever)** — sets `subscription_status='comped'` and clears `trial_ends_at`. Guard this behind a `confirm()` — it disables Stripe billing for that org.
- **Un-comp org** — reverts a comped org back to `trialing` with a fresh 14-day trial.
- **Invite user to this org** — opens a modal with an email input + role picker (`owner | admin | member | viewer`, from `INVITABLE_ROLES`). Wraps the existing `sendInvite` action from `src/lib/actions/invites.ts` but calls it with the target org's id instead of the caller's active org. You'll need a new server action (below) because `sendInvite` currently uses `requireActiveOrg()`.
- **Cancel subscription** — sets `subscription_status='canceled'` and leaves the Stripe subscription alone (owner still has to cancel in Stripe if needed — surface a note).

**New data reader** in `src/lib/data/platform-admin.ts`:
- Extend `getAdminOverview` or add `getAdminOrgs()` that returns the same rows but is safe to reuse in this new page without recomputing totals.

**New server actions** in `src/lib/actions/platform-trials.ts` (create it):

```ts
"use server";
import { requirePlatformAdmin } from "@/lib/data/platform-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export async function extendOrgTrial(orgId: string, days: 14 | 30 | 60) { /* ... */ }
export async function compOrg(orgId: string) { /* ... */ }
export async function uncompOrg(orgId: string) { /* ... */ }
export async function cancelOrgSubscription(orgId: string) { /* ... */ }
```

Every action:
1. `await requirePlatformAdmin();`
2. Use `createAdminClient()` for the write.
3. `revalidatePath("/admin")` and `revalidatePath("/admin/trials")` on success.
4. Return `{ error: string | null }` shape matching other actions.

**New server action** in `src/lib/actions/platform-invites.ts` (create it):

```ts
"use server";
import { requirePlatformAdmin } from "@/lib/data/platform-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { INVITABLE_ROLES, type InvitableRole } from "@/lib/data/invite-roles";
import { revalidatePath } from "next/cache";

export async function platformAdminInviteToOrg(
  orgId: string,
  email: string,
  role: InvitableRole
): Promise<{ error: string | null }> {
  await requirePlatformAdmin();
  // 1. Insert into organization_invites with (org_id=orgId, email, role, invited_by=<current admin's user_id>)
  //    using the admin client so it bypasses org RLS.
  // 2. Best-effort call Supabase auth admin.inviteUserByEmail (mirror the pattern in src/lib/actions/invites.ts sendInvite).
  // 3. Revalidate /admin/trials.
}
```

Read `sendInvite` in `src/lib/actions/invites.ts` first and mirror its guardrails (dedupe on `(org_id, email, accepted_at IS NULL)`, don't send a fresh email if a pending invite already exists in the last hour, etc.).

### Add tab

In `src/app/admin/admin-tabs.tsx`, add `{ href: "/admin/trials", label: "Trials & Billing" }` between `Users` and `Forms`.

### DB migration check

The `organizations` table already has `subscription_status`, `trial_ends_at`, `subscription_tier`, `onboarding_tier`, `onboarding_paid` columns (confirmed via `AdminOrgRow` type). A `'comped'` value for `subscription_status` is already used in the Overview page's `StatusBadge` — so no migration needed if that value is already accepted by whatever enum/check constraint exists.

Run this diagnostic first before writing the actions:

```bash
# From project root, with Supabase MCP or via psql to project tibyupxfosgnyrohruof:
select column_name, data_type, udt_name from information_schema.columns
where table_schema='public' and table_name='organizations' and column_name in
  ('subscription_status','trial_ends_at','subscription_tier','onboarding_tier','onboarding_paid');

-- And check if there's a check constraint on subscription_status:
select conname, pg_get_constraintdef(oid) from pg_constraint
where conrelid='public.organizations'::regclass and contype='c';
```

If `subscription_status` has a check constraint that doesn't include `'comped'`, write a migration (`supabase/migrations/<timestamp>_allow_comped_subscription_status.sql`) that drops+recreates the constraint with `'comped'` added. Commit the migration and apply via Supabase MCP.

---

## Task 2 — `/admin/noa` tab (NOA library CRUD)

**New route:** `src/app/admin/noa/page.tsx`
**New client component:** `src/app/admin/noa/platform-noa-manager.tsx` (mirror the shape of `src/app/admin/forms/platform-forms-manager.tsx`)

Table columns:

| Manufacturer | Series | Model | NOA # | Trade | Pressure (+/−) | Effective | Expiration | Actions |
|---|---|---|---|---|---|---|---|---|

Actions: **Edit** (opens dialog with the same shape as the Add dialog, prefilled) and **Delete** (with confirm).

**Toolbar buttons:**
- `Add NOA` — opens dialog with fields matching `NoaEntryInput` from `src/lib/actions/noa.ts`. Force `visibility: "platform"` (this tab only manages platform-wide NOAs).
- `Search` input — client-side filter on manufacturer / series / model / NOA #.
- `Trade filter` — dropdown: All / windows / doors / roofing.

**New data reader** in `src/lib/data/platform-noa.ts` (create it):

```ts
import { createAdminClient } from "@/lib/supabase/admin";

export type PlatformNoaRow = {
  id: string;
  manufacturer: string;
  window_type: string | null;
  series: string | null;
  model_number: string | null;
  noa_number: string;
  trade: string;
  pressure_pos: string | null;
  pressure_neg: string | null;
  effective_date: string | null;
  expiration_date: string | null;
  notes: string | null;
  visibility: "platform" | "org";
  created_at: string;
  updated_at: string | null;
};

export async function getPlatformNoaEntries(): Promise<{
  rows: PlatformNoaRow[];
  configError?: string;
}> {
  // 1. Try createAdminClient(); if service-role key missing, return { rows: [], configError: "..." }.
  // 2. select * from noa_entries where visibility = 'platform' order by manufacturer, series, model_number.
  // 3. Return rows.
}
```

**Server actions:** reuse `saveNoaEntry` and `deleteNoaEntry` from `src/lib/actions/noa.ts`. Confirm those functions accept `visibility: "platform"` from a platform-admin caller (they should — see `isPlatformAdmin` check inside `saveNoaEntry`). Do NOT add a new action file — keep NOA writes single-sourced.

If `deleteNoaEntry` doesn't already exist, add it to `src/lib/actions/noa.ts` with the same platform-admin gating pattern:

```ts
export async function deletePlatformNoaEntry(id: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  if (!(await isPlatformAdmin())) return { error: "Only platform admins can delete platform NOAs" };
  const admin = createAdminClient();
  const { error } = await admin.from("noa_entries").delete().eq("id", id).eq("visibility", "platform");
  if (error) return { error: error.message };
  revalidatePath("/admin/noa");
  return { error: null };
}
```

Guardrails on delete: **check for references first**. NOAs get matched into permit packages and pinned on jobs. Before deleting, query:

```sql
select count(*) from job_noa_pins where noa_entry_id = $1;
```

If any pins exist, block the delete and surface a message: "3 jobs currently pin this NOA. Unpin them first or archive this NOA (soft delete) instead." Consider adding an `archived_at` column to `noa_entries` in a migration if it doesn't exist, so admins can retire an expired NOA without breaking historical packages. Prefer archive over delete for NOAs that have ever been used.

### Add tab

In `admin-tabs.tsx`, add `{ href: "/admin/noa", label: "NOA Library" }`.

---

## Task 3 — Verify Forms library CRUD

The tab exists at `/admin/forms`. Open the page in the browser (or read `src/app/admin/forms/platform-forms-manager.tsx` end-to-end) and confirm:

- [ ] Add form: works, uploads PDF, saves row, refreshes list.
- [ ] Edit form: works, updates row, refreshes list.
- [ ] Delete form: works, confirms first, removes row.
- [ ] Field-mapping editor is reachable (or documented as a separate page — this is what maps PDF form fields to `JobDataKey` values). If it doesn't have delete confirmation, add one (`AlertDialog`).

**Important:** any change to Forms library must not touch `src/lib/forms/pdf-fill.ts`. That file was fixed 2026-08-30 to use `instanceof` for pdf-lib class checks (commit `92e4743`) after a production minifier bug made every PDF blank. There's now an ESLint rule (`no-restricted-syntax` in `eslint.config.mjs`) that blocks any regression. Do not modify that rule or the pdf-fill file as part of this admin work.

---

## Task 4 — Overview page: add per-row actions link

On `/admin` (Overview), add a final column "Manage" with a link `→ Trials & Billing` that scrolls or filters to that org on `/admin/trials?org={slug}`. Read `?org=` in the trials page and highlight/scroll to that row.

---

## Guardrails (must not skip)

1. **Every server action** — `await requirePlatformAdmin()` on first line. No exceptions.
2. **Every write** — `createAdminClient()` (service role), never the request-scoped user client, because you're intentionally writing across orgs.
3. **`revalidatePath`** on every path affected by the mutation.
4. **Confirm dialogs** on destructive actions: comp, cancel, delete NOA, delete form.
5. **Typecheck + lint clean** before commit:
   ```bash
   npx tsc --noEmit && npx eslint src/
   ```
6. **Commits authored as Angelique:**
   ```bash
   git -c user.email=padavano.angelique@gmail.com -c user.name="Angelique Padavano" commit -m "..."
   ```
7. **One PR per task** — do NOT merge Task 1 + Task 2 into one giant commit. Task 3 (verification) can piggyback on Task 1's PR only if it's a small delete-confirmation addition.
8. **Do not touch `src/lib/forms/pdf-fill.ts` or the ESLint rule that guards it.**
9. **No per-org hardcoding** — all logic must work for any org id.

## Rollout order

1. **Task 1 (Trials & Billing)** — highest impact for Angelique's day-to-day.
2. **Task 2 (NOA Library)** — second highest, unblocks bulk-adding NOAs from admin.
3. **Task 3 (Forms verify + delete confirmation)** — low-effort cleanup.
4. **Task 4 (Overview manage link)** — nice-to-have.

Each task: branch → build → typecheck → lint → E2E test locally against `permitaio.com`'s Supabase (project `tibyupxfosgnyrohruof`) using a test org → commit → push → verify on Vercel deploy → hand back to Angelique.

## After you finish

Update `/home/user/workspace/projects/roofing-permitsaio-1ZhC.gw4QFSSh1pElJb7Pw/knowledge/` (via `pplx project knowledge update`) with a page describing the admin dashboard architecture and the trial/comp state model so future sessions don't have to rediscover it.
