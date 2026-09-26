-- Filter Forms Generator matches by job trade, same convention already
-- used by requirements_forms/product_approvals: trade = 'general' means
-- the form applies to every job regardless of trade; a specific value
-- ('windows' | 'roofing') scopes it to just that trade. Free text (no
-- enum CHECK) so new trades can be added later without a migration.

alter table template_form_templates add column if not exists trade text not null default 'general';
alter table form_templates add column if not exists trade text not null default 'general';

-- Existing seeded rows are all generic county-wide permit application /
-- NOC / addendum forms that apply regardless of trade.
update template_form_templates set trade = 'general' where trade is null;
update form_templates set trade = 'general' where trade is null;

-- Extend the org-creation seed function to also copy the trade column.
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

  insert into form_templates (org_id, county, jurisdiction_code, jurisdiction_name, doc_type, title, description, file_name, file_data, field_mapping, sort_order, trade)
  select p_org_id, county, jurisdiction_code, jurisdiction_name, doc_type, title, description, file_name, file_data, field_mapping, sort_order, trade
  from template_form_templates;
end;
$$;
