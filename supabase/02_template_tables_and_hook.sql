-- Template/reference tables copied into every new org on creation, plus the
-- trigger hook that wires seeding into organization creation.
-- Final consolidated column set (matches production state after migration_02).

create table if not exists template_hoas (
  id bigint generated always as identity primary key,
  name text not null,
  mgmt_co text default '',
  contact_name text default '',
  phone text default '',
  email text default '',
  address text default '',
  qualifications text default '',
  notes text default ''
);

create table if not exists template_product_approvals (
  id bigint generated always as identity primary key,
  type text not null,
  manufacturer text not null,
  series text not null,
  noa text,
  pos numeric,
  neg numeric,
  trade text not null default 'windows'
);

create table if not exists template_requirements_forms (
  id bigint generated always as identity primary key,
  jurisdiction text not null,
  title text not null,
  notes text,
  file_name text,
  file_data text,
  county text,
  jurisdiction_code text,
  doc_type text not null default 'other',
  trade text not null default 'general',
  field_mapping jsonb not null default '{}'::jsonb
);

alter table template_hoas enable row level security;
alter table template_product_approvals enable row level security;
alter table template_requirements_forms enable row level security;

create policy "authenticated can read template hoas" on template_hoas
  for select to authenticated using (true);
create policy "authenticated can read template product approvals" on template_product_approvals
  for select to authenticated using (true);
create policy "authenticated can read template requirements forms" on template_requirements_forms
  for select to authenticated using (true);

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
end;
$$;

create or replace function handle_new_organization()
returns trigger language plpgsql as $$
begin
  perform seed_default_stages(new.id);
  perform seed_org_reference_data(new.id);
  return new;
end;
$$;

drop trigger if exists trg_new_org_seed_stages on organizations;
create trigger trg_new_org_seed_stages after insert on organizations
  for each row execute function handle_new_organization();
