alter table public.install_job_assignments
add column if not exists scheduled_date date;
