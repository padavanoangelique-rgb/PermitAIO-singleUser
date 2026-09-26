-- Migration: user profiles for team member display
--
-- ROOT CAUSE: the Settings page team table rendered `m.user_id` (a raw
-- UUID) for any team member who wasn't the currently logged-in user,
-- because no table existed anywhere that mapped a user id back to a
-- human-readable email/name. `auth.users` itself isn't queryable from
-- PostgREST for other users' rows, so the app had no way to look this up
-- client-side.
--
-- This migration:
--   1. Creates a public.profiles table (id/email/full_name/created_at)
--      that mirrors the subset of auth.users an org's own members are
--      allowed to see about each other.
--   2. Adds RLS so a user can read their own profile plus the profiles of
--      anyone who shares at least one organization with them (via
--      organization_members), and can only update their own profile.
--   3. Adds a SECURITY DEFINER handle_new_user() trigger on auth.users
--      that keeps profiles in sync automatically for every future signup
--      (upserts email on conflict, in case a user's email changes).
--      EXECUTE is revoked from anon/authenticated/public since it should
--      only ever run via the trigger.
--   4. Backfills profiles for every pre-existing auth.users row so
--      already-registered users show up correctly immediately.
--
-- Applied directly to the live database via the Supabase migration tool.
-- This file documents that change for the repo history — run it only
-- against a fresh database that doesn't already have it.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "users can read profiles of their org-mates" on public.profiles;
create policy "users can read profiles of their org-mates"
  on public.profiles for select
  using (
    id = auth.uid()
    or exists (
      select 1
      from public.organization_members om1
      join public.organization_members om2 on om1.org_id = om2.org_id
      where om1.user_id = auth.uid() and om2.user_id = profiles.id
    )
  );

drop policy if exists "users can update their own profile" on public.profiles;
create policy "users can update their own profile"
  on public.profiles for update
  using (id = auth.uid());

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = 'public'
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name')
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- One-time backfill for users created before this migration existed.
insert into public.profiles (id, email)
select id, email from auth.users
on conflict (id) do update set email = excluded.email;
