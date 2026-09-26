-- ============================================================================
-- PermitAIO — Team member invites
-- ============================================================================
-- Lets an org Owner/Admin invite a teammate by email with an assigned role
-- (admin / manager / member — never "owner", which only ever exists by
-- creating the org or via a future ownership-transfer feature).
--
-- Two acceptance paths, both landing the invited person in
-- organization_members with zero extra clicks where possible:
--
--   1. Brand-new email (no existing auth.users row): the invite action
--      calls supabase.auth.admin.inviteUserByEmail(), which creates the
--      auth.users row immediately and emails a sign-in link. The
--      `on_auth_user_created_join_invited_orgs` trigger below fires on that
--      INSERT and immediately creates the organization_members row + marks
--      the invite accepted — the person is a full member before they've
--      even opened the email. Clicking the email link only lets them set a
--      password via the existing /auth/callback -> /onboarding flow.
--
--   2. Already-registered email: inviteUserByEmail errors ("already
--      registered"), so no new auth.users row is created and the trigger
--      never fires. The organization_invites row stays pending; the
--      invited user sees it as an "Accept" banner next time they're in the
--      app (matched against their own profiles.email — see
--      src/lib/data/invites.ts) and a server action inserts the membership
--      row directly when they accept.
--
-- Purely additive on top of 10_user_profiles.sql (profiles table) and
-- schema.sql (is_org_admin()). Does not touch jobs/floor_plans/hoa/permit
-- inventory data or logic.
-- ============================================================================

create table if not exists public.organization_invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin', 'manager', 'member')),
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '14 days'),
  accepted_at timestamptz,
  revoked_at timestamptz
);

create index if not exists idx_org_invites_org on public.organization_invites (org_id);
create index if not exists idx_org_invites_email on public.organization_invites (lower(email));

-- Only one live (unaccepted, unrevoked) invite per org+email at a time —
-- re-inviting after a revoke or expiry is fine, this just stops duplicates
-- piling up while one is still outstanding.
create unique index if not exists organization_invites_org_email_pending_idx
  on public.organization_invites (org_id, lower(email))
  where accepted_at is null and revoked_at is null;

alter table public.organization_invites enable row level security;

drop policy if exists "org admins manage invites" on public.organization_invites;
create policy "org admins manage invites" on public.organization_invites
  for all
  using (is_org_admin(org_id))
  with check (is_org_admin(org_id));

-- An invited person can always see (and accept) invites addressed to their
-- own email, even for orgs they don't belong to yet. profiles.email always
-- exists for the caller's own row (seeded by handle_new_user()), and its
-- self-select RLS policy already allows this read.
drop policy if exists "invited user can see their own invites" on public.organization_invites;
create policy "invited user can see their own invites" on public.organization_invites
  for select
  using (
    lower(email) = lower((select email from public.profiles where id = auth.uid()))
  );

-- An invited person can accept (mark accepted_at) their own pending invite.
-- Org-admin management above already covers admin-side updates (revoke).
drop policy if exists "invited user can accept their own invite" on public.organization_invites;
create policy "invited user can accept their own invite" on public.organization_invites
  for update
  using (
    lower(email) = lower((select email from public.profiles where id = auth.uid()))
    and accepted_at is null
    and revoked_at is null
  )
  with check (
    lower(email) = lower((select email from public.profiles where id = auth.uid()))
  );

-- Auto-join: when a brand-new auth.users row appears (via the admin
-- inviteUserByEmail call, or an ordinary signup that happens to match a
-- pending invite email), immediately create the organization_members
-- row(s) for every live invite addressed to that email and mark them
-- accepted. SECURITY DEFINER so it can write organization_members
-- regardless of the new row having no session/RLS context yet.
create or replace function public.handle_invited_user_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  inv record;
begin
  for inv in
    select id, org_id, role
    from public.organization_invites
    where lower(email) = lower(new.email)
      and accepted_at is null
      and revoked_at is null
      and expires_at > now()
  loop
    insert into public.organization_members (org_id, user_id, role)
    values (inv.org_id, new.id, inv.role)
    on conflict (org_id, user_id) do nothing;

    update public.organization_invites
    set accepted_at = now()
    where id = inv.id;
  end loop;

  return new;
end;
$$;

revoke all on function public.handle_invited_user_signup() from public, anon, authenticated;

drop trigger if exists on_auth_user_created_join_invited_orgs on auth.users;
create trigger on_auth_user_created_join_invited_orgs
  after insert on auth.users
  for each row execute function public.handle_invited_user_signup();
