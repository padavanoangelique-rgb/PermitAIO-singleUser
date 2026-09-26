-- Relax the county CHECK constraint on form_templates /
-- template_form_templates from a closed 3-value enum (Broward,
-- Miami-Dade, Palm Beach) to a simple non-empty check. This leaves room
-- to add more counties later (e.g. via Forms Library seed inserts) without
-- a schema migration blocking the insert. County-specific parsing logic
-- (folio/PCN digit formats) still lives in src/lib/forms/folio.ts and does
-- need a small code change per new county — this migration only removes
-- the database-level lock.

alter table public.form_templates drop constraint form_templates_county_check;
alter table public.form_templates add constraint form_templates_county_check check (length(trim(county)) > 0);

alter table public.template_form_templates drop constraint template_form_templates_county_check;
alter table public.template_form_templates add constraint template_form_templates_county_check check (length(trim(county)) > 0);
