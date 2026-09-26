-- Forms Generator: actual fillable/generatable permit documents (Permit
-- Application, Notice of Commencement, municipality-specific addendums),
-- distinct from `requirements_forms` (the informational contact/notes
-- reference library, which stays untouched — 6 rows, ported as-is).
--
-- Matching model (additive, not either/or):
--   - jurisdiction_code IS NULL  -> "county-wide base" form. Included for
--     EVERY job in that county regardless of municipality (e.g. Broward's
--     Permit Application + NOC apply to every Broward job since Broward's
--     folio/ID# doesn't encode a municipality; Miami-Dade's base RER forms
--     apply to unincorporated (code 30) and every city without its own row).
--   - jurisdiction_code = '01'..'77' -> addendum form that ADDS ON TOP of the
--     county-wide base forms, only for that specific municipality code
--     (Miami-Dade/Palm Beach only — looked up via folio_jurisdiction_codes).
--
-- template_form_templates is the global source seeded/managed by the
-- platform owner; it's copied into every org (existing + new) exactly the
-- way template_hoas / template_product_approvals / template_requirements_forms
-- already work, via seed_org_reference_data().

create table if not exists template_form_templates (
  id bigint generated always as identity primary key,
  -- Not restricted to a fixed enum so new counties can be added later
  -- without a schema migration blocking template inserts.
  county text not null check (length(trim(county)) > 0),
  jurisdiction_code text,
  jurisdiction_name text,
  doc_type text not null default 'other', -- 'permit_application' | 'notice_of_commencement' | 'addendum' | 'affidavit' | 'other'
  title text not null,
  description text default '',
  file_name text,
  file_data text,
  field_mapping jsonb not null default '{}'::jsonb,
  sort_order int not null default 0
);

create table if not exists form_templates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  -- Not restricted to a fixed enum so new counties can be added later
  -- without a schema migration blocking template inserts.
  county text not null check (length(trim(county)) > 0),
  jurisdiction_code text,
  jurisdiction_name text,
  doc_type text not null default 'other',
  title text not null,
  description text default '',
  file_name text,
  file_data text,
  field_mapping jsonb not null default '{}'::jsonb,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_form_templates_org on form_templates (org_id);
create index if not exists idx_form_templates_org_county on form_templates (org_id, county);

alter table template_form_templates enable row level security;
alter table form_templates enable row level security;

drop policy if exists "authenticated can read template form templates" on template_form_templates;
create policy "authenticated can read template form templates" on template_form_templates
  for select to authenticated using (true);

drop policy if exists "members can read form_templates" on form_templates;
create policy "members can read form_templates" on form_templates
  for select using (is_org_member(org_id));
drop policy if exists "members can write form_templates" on form_templates;
create policy "members can write form_templates" on form_templates
  for all using (is_org_member(org_id)) with check (is_org_member(org_id));

drop trigger if exists trg_form_templates_updated_at on form_templates;
create trigger trg_form_templates_updated_at
  before update on form_templates
  for each row execute function set_updated_at();

-- Extend the org-creation seed function to also copy form_templates.
create or replace function seed_org_reference_data(p_org_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
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

  insert into form_templates (org_id, county, jurisdiction_code, jurisdiction_name, doc_type, title, description, file_name, file_data, field_mapping, sort_order)
  select p_org_id, county, jurisdiction_code, jurisdiction_name, doc_type, title, description, file_name, file_data, field_mapping, sort_order
  from template_form_templates;
end;
$$;

-- Seed the 6 county-wide base forms (2 per county: Permit Application + NOC).
-- No files yet — blank PDF templates are uploaded by the platform owner
-- after launch via the in-app Forms Library admin page.
insert into template_form_templates (county, jurisdiction_code, jurisdiction_name, doc_type, title, description, sort_order) values
('Broward', null, 'Broward County (all municipalities)', 'permit_application', 'Broward County Building Permit Application', 'County-wide Uniform Building Permit Application used for every Broward job — Broward''s folio/ID# doesn''t encode a municipality, so this always applies regardless of city.', 10),
('Broward', null, 'Broward County (all municipalities)', 'notice_of_commencement', 'Broward County Notice of Commencement (NOC)', 'County-wide NOC recorded for permit jobs over the statutory threshold.', 20),
('Miami-Dade', null, 'Miami-Dade County (unincorporated + cities without their own form)', 'permit_application', 'Miami-Dade RER Building Permit Application', 'County-wide RER permit application. Applies to unincorporated Miami-Dade (code 30) and any municipality without its own dedicated addendum below.', 10),
('Miami-Dade', null, 'Miami-Dade County (unincorporated + cities without their own form)', 'notice_of_commencement', 'Miami-Dade Notice of Commencement (NOC)', 'County-wide NOC recorded for permit jobs over the statutory threshold.', 20),
('Palm Beach', null, 'Palm Beach County (unincorporated + cities without their own form)', 'permit_application', 'Palm Beach County PZB Building Permit Application', 'County-wide PZB permit application. Applies to unincorporated Palm Beach County (code 00) and any municipality without its own dedicated addendum below.', 10),
('Palm Beach', null, 'Palm Beach County (unincorporated + cities without their own form)', 'notice_of_commencement', 'Palm Beach County Notice of Commencement (NOC)', 'County-wide NOC recorded for permit jobs over the statutory threshold.', 20)
on conflict do nothing;
