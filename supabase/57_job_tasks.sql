-- Job-attached shared tasks: a lightweight to-do hanging off a job,
-- assignable to a teammate. "Ask for update" on a task reuses the existing
-- notifications table (source "team_request") and its reply flow, so this
-- table only needs to hold the task itself.

create table if not exists job_tasks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  job_id uuid not null references jobs(id) on delete cascade,
  title text not null,
  assigned_to uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  done_at timestamptz,
  created_at timestamptz not null default now()
  );

create index if not exists job_tasks_job_id_idx on job_tasks (job_id);
create index if not exists job_tasks_org_id_idx on job_tasks (org_id);
create index if not exists job_tasks_assigned_to_idx on job_tasks (assigned_to);

alter table job_tasks enable row level security;

-- Same org-membership check every other org-scoped table in this schema
-- uses (see the RLS comment on organization_members in src/lib/data/orgs.ts).
create policy "org members can view job tasks"
on job_tasks for select
using (org_id in (select org_id from organization_members where user_id = auth.uid()));

create policy "org members can create job tasks"
on job_tasks for insert
with check (org_id in (select org_id from organization_members where user_id = auth.uid()));

create policy "org members can update job tasks"
on job_tasks for update
using (org_id in (select org_id from organization_members where user_id = auth.uid()));

create policy "org members can delete job tasks"
on job_tasks for delete
using (org_id in (select org_id from organization_members where user_id = auth.uid()));
