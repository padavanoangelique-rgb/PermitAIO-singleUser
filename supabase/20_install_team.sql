-- Install Dashboard roster and job assignments.
-- Does not alter jobs, permits, or organization_members.
-- Job number on jobs remains the source of truth.

create table if not exists public.install_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  email text not null,
  role text not null check (role in ('install_manager','project_manager','installer')),
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (org_id, email, role)
);

create table if not exists public.install_job_assignments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  job_number text not null,
  installer_id uuid references public.install_members(id) on delete set null,
  pm_id uuid references public.install_members(id) on delete set null,
  assigned_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (org_id, job_id)
);

create index if not exists install_members_org_idx on public.install_members (org_id);
create index if not exists install_jobs_org_idx on public.install_job_assignments (org_id);

alter table public.install_members enable row level security;
alter table public.install_job_assignments enable row level security;

drop policy if exists install_members_org_read on public.install_members;
create policy install_members_org_read on public.install_members
  for select using (
    org_id in (select org_id from public.organization_members where user_id = auth.uid())
  );

drop policy if exists install_members_org_write on public.install_members;
create policy install_members_org_write on public.install_members
  for all using (
    org_id in (select org_id from public.organization_members where user_id = auth.uid())
  ) with check (
    org_id in (select org_id from public.organization_members where user_id = auth.uid())
  );

drop policy if exists install_jobs_org_read on public.install_job_assignments;
create policy install_jobs_org_read on public.install_job_assignments
  for select using (
    org_id in (select org_id from public.organization_members where user_id = auth.uid())
  );

drop policy if exists install_jobs_org_write on public.install_job_assignments;
create policy install_jobs_org_write on public.install_job_assignments
  for all using (
    org_id in (select org_id from public.organization_members where user_id = auth.uid())
  ) with check (
    org_id in (select org_id from public.organization_members where user_id = auth.uid())
  );
