-- Broward city forms must never use the first two folio digits as jurisdiction_code.
-- Folio prefix is township/range, not municipality. City matching is by
-- jurisdiction_name (Davie, Miramar, …) plus the 4-digit BCPA millage code
-- stored on job_permit_details.broward_tax_district_code.
--
-- Clear 2-digit Broward codes that were mistakenly copied from folio heads.
update form_templates
set jurisdiction_code = null
where county = 'Broward'
  and jurisdiction_code is not null
  and length(regexp_replace(jurisdiction_code, '[^0-9]', '', 'g')) <= 2;

update template_form_templates
set jurisdiction_code = null
where county = 'Broward'
  and jurisdiction_code is not null
  and length(regexp_replace(jurisdiction_code, '[^0-9]', '', 'g')) <= 2;
