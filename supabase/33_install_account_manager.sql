-- Account manager sits between install manager and field crew.
-- Install manager is assigned in Settings. They assign account managers.
-- Account managers assign project managers and installers per job.

alter table public.install_members
  drop constraint if exists install_members_role_check;

alter table public.install_members
  add constraint install_members_role_check
  check (role in ('install_manager', 'account_manager', 'project_manager', 'installer'));

alter table public.install_job_assignments
  add column if not exists account_manager_id uuid references public.install_members(id) on delete set null;

create index if not exists install_jobs_am_idx
  on public.install_job_assignments (account_manager_id);
