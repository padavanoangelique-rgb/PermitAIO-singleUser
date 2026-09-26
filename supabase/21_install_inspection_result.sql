alter table public.install_job_assignments
  add column if not exists inspection_status text,
  add column if not exists inspection_result text,
  add column if not exists inspection_date date;
