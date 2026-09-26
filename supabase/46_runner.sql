-- Permit Runner module: a stripped-down role that only ever sees the job
-- number, destination, and note for a run a tech hands off — mirrors the
-- Install module's own roster/assignment table pattern (install_members /
-- install_job_assignments) rather than the shared jobs table, which is
-- what keeps her view from leaking client name, address, or money.

create table if not exists runner_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  email text not null,
  user_id uuid references auth.users(id),
  display_name text,
  created_at timestamptz not null default now(),
  unique (org_id, email)
);

create table if not exists runner_jobs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  job_id uuid not null references jobs(id) on delete cascade,
  job_number text not null,
  place text not null,
  note text,
  runner_id uuid references runner_members(id),
  assigned_by_email text,
  checked_in_at timestamptz,
  checked_out_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_runner_members_org on runner_members (org_id);
create index if not exists idx_runner_jobs_org on runner_jobs (org_id);
create index if not exists idx_runner_jobs_runner on runner_jobs (runner_id);

alter table runner_members enable row level security;
alter table runner_jobs enable row level security;

create policy "members can read runner roster" on runner_members for select using (is_org_member(org_id));
create policy "members can write runner roster" on runner_members for all using (is_org_member(org_id)) with check (is_org_member(org_id));
create policy "members can read runner jobs" on runner_jobs for select using (is_org_member(org_id));
create policy "members can write runner jobs" on runner_jobs for all using (is_org_member(org_id)) with check (is_org_member(org_id));

-- Let "runner" through the open self-serve join-code role picker, same as
-- account_manager/project_manager/installer were added in
-- 44_widen_role_join_requests.sql.
alter table role_join_requests drop constraint if exists role_join_requests_requested_role_check;
alter table role_join_requests add constraint role_join_requests_requested_role_check
  check (requested_role in ('permit_tech', 'hoa_tech', 'manager', 'account_manager', 'project_manager', 'installer', 'runner'));
