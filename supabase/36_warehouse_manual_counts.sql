-- Manual window/door counts when a job has no floor plan.
alter table public.warehouse_jobs
  add column if not exists manual_windows integer,
  add column if not exists manual_doors integer;
