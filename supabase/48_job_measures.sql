-- Measure Tech field app. Separate from floor_plans (office Permit Builder).
-- Job number is the source of truth. One measure sheet per job.

create table if not exists job_measures (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  job_id uuid not null references jobs(id) on delete cascade,
  job_number text not null,
  plan_data jsonb not null,
  schedule jsonb,
  submitted_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (org_id, job_id)
);

create index if not exists idx_job_measures_org on job_measures (org_id);
create index if not exists idx_job_measures_job_number on job_measures (org_id, job_number);

alter table job_measures enable row level security;

create policy "members can read job measures" on job_measures
  for select using (is_org_member(org_id));
create policy "members can write job measures" on job_measures
  for all using (is_org_member(org_id)) with check (is_org_member(org_id));
