-- Owner assigns a role in Settings first. /join matches this email
-- and applies the role (including permit/HOA desk) when they create a password.

create table if not exists public.assigned_roles (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role text not null,
  tech_slot text,
  created_at timestamptz not null default now(),
  unique (org_id, email)
);

create index if not exists assigned_roles_org_idx on public.assigned_roles (org_id);

alter table public.assigned_roles enable row level security;

drop policy if exists assigned_roles_org_read on public.assigned_roles;
create policy assigned_roles_org_read on public.assigned_roles
  for select using (
    org_id in (select org_id from public.organization_members where user_id = auth.uid())
  );

drop policy if exists assigned_roles_org_write on public.assigned_roles;
create policy assigned_roles_org_write on public.assigned_roles
  for all using (
    org_id in (select org_id from public.organization_members where user_id = auth.uid())
  ) with check (
    org_id in (select org_id from public.organization_members where user_id = auth.uid())
  );
