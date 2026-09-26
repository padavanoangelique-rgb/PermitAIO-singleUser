-- Additive roster fields for Install Dashboard.
-- Does not change jobs or assignments.

alter table public.install_members
  add column if not exists display_name text;

alter table public.install_members
  add column if not exists company_name text;
