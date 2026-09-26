-- Permit checkout stamp for the Install overview "Permit out" chip.
alter table public.install_job_assignments
  add column if not exists permit_checked_out_at timestamptz,
  add column if not exists permit_checked_out_by text;
