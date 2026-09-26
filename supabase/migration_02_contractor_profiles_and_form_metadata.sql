-- Migration: add_contractor_profiles_and_form_metadata
-- Applied to Supabase project gkckgzruadshnblxtxiq on 2026-08-22
--
-- Context / decisions from user (2026-08-22 check-in):
-- 1. Contractor info: user wants MULTIPLE saved contractor profiles per org (e.g. a
--    roofing contractor and a window contractor), selectable via dropdown per job/form.
--    -> contractor_profiles table (org-scoped, RLS via is_org_member).
-- 2. Addendums/affidavits/permit applications/NOC should NOT be a separate module --
--    they live in the same jurisdiction-organized Forms Generator list as regular permit
--    forms, just tagged by doc_type. Goal stated by user: typing in a folio number (e.g.
--    a Miramar folio) should auto-populate the permit application, affidavit, and Notice
--    of Commencement pre-filled with as much job/contractor data as possible -- no manual
--    searching. This requires (future, once real fillable PDFs are uploaded): a field_mapping
--    JSON per form that maps PDF field names to data source keys (job.folio_number,
--    job.address, job.client_name, contractor.company_name, contractor.license_number, etc.)
--    so the Permit Package Generator / Forms Generator can fill + flatten PDFs at generation time.
-- 3. Roofing NOAs work like the window/door product approval tracker, but keyed by tile/
--    shingle STYLE instead of a window/door schedule -- reuses product_approvals /
--    template_product_approvals (already generic: type, manufacturer, series, noa, pos, neg),
--    just tagged with a new `trade` column ('windows' vs 'roofing') so the two trades can be
--    filtered separately. User has not finalized the roofing manual process yet -- schema is
--    intentionally left open (trade column, doc_type/field_mapping on forms) to extend as the
--    roofing workflow is worked out through daily use.

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

alter table template_requirements_forms
  add column if not exists doc_type text not null default 'other',
  add column if not exists trade text not null default 'general',
  add column if not exists field_mapping jsonb not null default '{}'::jsonb;

-- product_approvals: tag existing rows 'windows' (all 25 seeded rows are window/door types);
-- roofing tile/shingle + NOA entries will be added later with trade='roofing'.
alter table product_approvals
  add column if not exists trade text not null default 'windows';

alter table template_product_approvals
  add column if not exists trade text not null default 'windows';

update template_product_approvals set trade = 'windows' where trade is null or trade = '';

-- seed_org_reference_data(): updated to copy the new columns into new orgs
create or replace function public.seed_org_reference_data(p_org_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  insert into hoas (org_id, name, mgmt_co, contact_name, phone, email, address, qualifications, notes)
  select p_org_id, name, mgmt_co, contact_name, phone, email, address, qualifications, notes
  from template_hoas;

  insert into product_approvals (org_id, type, manufacturer, series, noa, pos, neg, trade)
  select p_org_id, type, manufacturer, series, noa, pos, neg, trade
  from template_product_approvals;

  insert into requirements_forms (org_id, jurisdiction, title, notes, file_name, file_data, county, jurisdiction_code, doc_type, trade, field_mapping)
  select p_org_id, jurisdiction, title, notes, file_name, file_data, county, jurisdiction_code, doc_type, trade, field_mapping
  from template_requirements_forms;
end;
$function$;

-- Verified 2026-08-22: created throwaway org, confirmed hoas=545, product_approvals=25,
-- requirements_forms=6, stages=22, contractor_profiles=0 (correctly empty -- user adds
-- their own contractor profiles per org), then deleted the test org (cascade delete confirmed clean).
