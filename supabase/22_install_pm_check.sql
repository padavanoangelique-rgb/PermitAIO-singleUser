-- Project manager field check-in. Does not change jobs/permits.
alter table public.install_job_assignments
  add column if not exists pm_checked_at timestamptz,
  add column if not exists pm_checked_by text;
