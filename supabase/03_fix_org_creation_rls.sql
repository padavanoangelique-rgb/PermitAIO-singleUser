-- Migration: fix org-creation RLS bug
--
-- ROOT CAUSE: handle_new_organization() and seed_default_stages() were
-- defined as SECURITY INVOKER (the Postgres default), so their inserts
-- (into `stages`, and — critically — no insert into `organization_members`
-- existed at all before this fix) were evaluated under RLS for a user who
-- is not yet a member of the org they just created. No code anywhere
-- actually inserted the creating user into `organization_members` as
-- owner, so every "create organization" request failed with
-- "new row violates row-level security policy".
--
-- This migration:
--   1. Makes handle_new_organization() and seed_default_stages()
--      SECURITY DEFINER (with a locked-down search_path) so their inserts
--      run with elevated privilege, bypassing RLS for the trigger's own
--      internal writes.
--   2. Adds the missing INSERT into organization_members (org owner)
--      inside handle_new_organization(), before seeding stages/reference
--      data.
--   3. Adds a `created_by` column to `organizations` and extends its
--      SELECT policy to also allow `created_by = auth.uid()`. This is
--      needed because Postgres re-checks the SELECT policy for a
--      RETURNING clause using the row's state at the moment it is
--      projected — which happens before an AFTER INSERT trigger's side
--      effects (like the owner membership row) are visible to that same
--      projection. Relying only on `is_org_member(id)` for the SELECT
--      policy meant `INSERT ... RETURNING *` still failed even after the
--      trigger correctly created the membership row, because from
--      Postgres's perspective the membership row didn't exist yet at the
--      point RETURNING was evaluated for the newly inserted org row.
--   4. Revokes EXECUTE on the internal-only seed functions
--      (handle_new_organization, seed_default_stages,
--      seed_org_reference_data) from anon/authenticated/public, since
--      they are only meant to run via the trigger and should never be
--      callable directly over PostgREST RPC — otherwise a signed-in user
--      could call seed_org_reference_data(any_org_id) directly and
--      duplicate template reference data into an org they don't belong
--      to. Triggers do not need explicit EXECUTE grants to fire, so this
--      is safe.
--
-- Applied directly to the live database via the Supabase migration tool
-- on 2026-08-22. This file documents that change for the repo history —
-- run it only against a fresh database that doesn't already have it.

alter table public.organizations
  add column if not exists created_by uuid references auth.users(id) default auth.uid();

drop policy if exists "members can read their org" on public.organizations;
create policy "members can read their org"
  on public.organizations for select
  using (is_org_member(id) or created_by = auth.uid());

create or replace function public.handle_new_organization()
returns trigger
language plpgsql
security definer
set search_path = 'public'
as $$
begin
  insert into public.organization_members (org_id, user_id, role)
  values (new.id, auth.uid(), 'owner')
  on conflict (org_id, user_id) do nothing;

  perform public.seed_default_stages(new.id);
  perform public.seed_org_reference_data(new.id);

  return new;
end;
$$;

-- seed_default_stages(uuid) and seed_org_reference_data(uuid) bodies are
-- unchanged from 02_template_tables_and_hook.sql — only their
-- SECURITY/search_path attributes changed:
alter function public.seed_default_stages(uuid) security definer set search_path = 'public';
alter function public.seed_org_reference_data(uuid) security definer set search_path = 'public';
alter function public.is_org_member(uuid) set search_path = 'public';
alter function public.is_org_admin(uuid) set search_path = 'public';
alter function public.set_updated_at() set search_path = 'public';

revoke execute on function public.handle_new_organization() from public, anon, authenticated;
revoke execute on function public.seed_default_stages(uuid) from public, anon, authenticated;
revoke execute on function public.seed_org_reference_data(uuid) from public, anon, authenticated;
