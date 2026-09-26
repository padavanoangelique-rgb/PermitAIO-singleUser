-- Service Dashboard roster and job assignments.
-- Mirrors Install: job number is the source of truth. Service is assigned to a service tech.

create table if not exists public.service_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  email text not null,
  role text not null check (role in ('service_manager','service_tech')),
  display_name text,
  company_name text,
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (org_id, email, role)
);

create table if not exists public.service_job_assignments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  job_number text not null,
  service_tech_id uuid references public.service_members(id) on delete set null,
  scheduled_date date,
  status text not null default 'open' check (status in ('open','scheduled','completed','cancelled')),
  assigned_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (org_id, job_id)
);

create index if not exists service_members_org_idx on public.service_members (org_id);
create index if not exists service_jobs_org_idx on public.service_job_assignments (org_id);
create index if not exists service_jobs_tech_idx on public.service_job_assignments (service_tech_id);

alter table public.service_members enable row level security;
alter table public.service_job_assignments enable row level security;

drop policy if exists service_members_org_read on public.service_members;
create policy service_members_org_read on public.service_members
  for select using (
    org_id in (select org_id from public.organization_members where user_id = auth.uid())
  );

drop policy if exists service_members_org_write on public.service_members;
create policy service_members_org_write on public.service_members
  for all using (
    org_id in (select org_id from public.organization_members where user_id = auth.uid())
  ) with check (
    org_id in (select org_id from public.organization_members where user_id = auth.uid())
  );

drop policy if exists service_jobs_org_read on public.service_job_assignments;
create policy service_jobs_org_read on public.service_job_assignments
  for select using (
    org_id in (select org_id from public.organization_members where user_id = auth.uid())
  );

drop policy if exists service_jobs_org_write on public.service_job_assignments;
create policy service_jobs_org_write on public.service_job_assignments
  for all using (
    org_id in (select org_id from public.organization_members where user_id = auth.uid())
  ) with check (
    org_id in (select org_id from public.organization_members where user_id = auth.uid())
  );

alter table public.role_join_requests drop constraint if exists role_join_requests_requested_role_check;
alter table public.role_join_requests add constraint role_join_requests_requested_role_check
  check (requested_role in (
    'permit_tech', 'hoa_tech', 'manager', 'account_manager', 'project_manager',
    'installer', 'runner', 'service_tech'
  ));
