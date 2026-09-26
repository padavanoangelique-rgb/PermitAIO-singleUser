-- Adapted from migration_02_contractor_profiles_and_form_metadata.sql for fresh-project
-- application: the ALTER TABLE statements on template_requirements_forms /
-- template_product_approvals are omitted here because 02_template_tables_and_hook.sql
-- creates those tables with the final column set (trade/doc_type/field_mapping) already
-- built in, so no ALTER is needed on this fresh project.

create table if not exists contractor_profiles (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  trade text not null default 'general', -- 'windows' | 'roofing' | 'general' | 'other'
  company_name text not null,
  license_number text,
  contact_name text,
  phone text,
  email text,
  address text,
  logo_url text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table contractor_profiles enable row level security;

create policy "members can read contractor_profiles" on contractor_profiles
  for select using (is_org_member(org_id));
create policy "members can write contractor_profiles" on contractor_profiles
  for all using (is_org_member(org_id)) with check (is_org_member(org_id));

create trigger trg_contractor_profiles_updated_at
  before update on contractor_profiles
  for each row execute function set_updated_at();

create index if not exists idx_contractor_profiles_org on contractor_profiles(org_id);

-- requirements_forms: doc_type ('permit_application' | 'affidavit' | 'notice_of_commencement'
-- | 'addendum' | 'other'), trade ('windows' | 'roofing' | 'general'), field_mapping (jsonb,
-- PDF field name -> data source key) for future auto-fill.
alter table requirements_forms
  add column if not exists doc_type text not null default 'other',
  add column if not exists trade text not null default 'general',
  add column if not exists field_mapping jsonb not null default '{}'::jsonb;

-- product_approvals: tag existing rows 'windows' (all 25 seeded rows are window/door types);
-- roofing tile/shingle + NOA entries will be added later with trade='roofing'.
alter table product_approvals
  add column if not exists trade text not null default 'windows';
