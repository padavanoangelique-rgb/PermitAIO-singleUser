-- Warehouse receiving checklist.
-- One line per floor-plan opening. Check in against product approval.
-- When every opening is checked in, the job is emailed to the assigned
-- recipient and lands on the manager Need to be scheduled list.
-- Does not write jobs.stage or jobs.sub_status.

create table if not exists public.warehouse_settings (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  notify_email text,
  updated_at timestamptz not null default now()
);

create table if not exists public.warehouse_jobs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  job_number text not null,
  ready_for_schedule_at timestamptz,
  notified_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (org_id, job_id)
);

create table if not exists public.warehouse_checkins (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  opening_key text not null,
  received_at timestamptz,
  received_by text,
  broken boolean not null default false,
  note text,
  photo_path text,
  photo_name text,
  updated_at timestamptz not null default now(),
  unique (org_id, job_id, opening_key)
);

create index if not exists warehouse_jobs_org_idx on public.warehouse_jobs (org_id);
create index if not exists warehouse_checkins_job_idx on public.warehouse_checkins (org_id, job_id);

alter table public.warehouse_settings enable row level security;
alter table public.warehouse_jobs enable row level security;
alter table public.warehouse_checkins enable row level security;

drop policy if exists warehouse_settings_org on public.warehouse_settings;
create policy warehouse_settings_org on public.warehouse_settings
  for all using (
    org_id in (select org_id from public.organization_members where user_id = auth.uid())
  ) with check (
    org_id in (select org_id from public.organization_members where user_id = auth.uid())
  );

drop policy if exists warehouse_jobs_org on public.warehouse_jobs;
create policy warehouse_jobs_org on public.warehouse_jobs
  for all using (
    org_id in (select org_id from public.organization_members where user_id = auth.uid())
  ) with check (
    org_id in (select org_id from public.organization_members where user_id = auth.uid())
  );

drop policy if exists warehouse_checkins_org on public.warehouse_checkins;
create policy warehouse_checkins_org on public.warehouse_checkins
  for all using (
    org_id in (select org_id from public.organization_members where user_id = auth.uid())
  ) with check (
    org_id in (select org_id from public.organization_members where user_id = auth.uid())
  );
