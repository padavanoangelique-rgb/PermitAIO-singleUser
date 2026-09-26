-- Shared HOA main frame + per-company drawer.
-- Spine = name/city/mgmt/public ARC (every shop reads this).
-- Overlay = that shop's COI + ARC files + notes (Premier cannot see Guardian).
-- New orgs no longer receive a cloned copy of template_hoas.

create table if not exists hoa_spine (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  name_norm text generated always as (lower(trim(name))) stored,
  city text,
  county text,
  address text,
  mgmt_co text,
  contact_name text,
  phone text,
  email text,
  public_arc_url text,
  qualifications text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hoa_spine_name_norm_idx on hoa_spine (name_norm);
create index if not exists hoa_spine_name_trgm_idx on hoa_spine using gin (name gin_trgm_ops);
create index if not exists hoa_spine_city_idx on hoa_spine (lower(city));

-- trgm may not exist yet
create extension if not exists pg_trgm;

create table if not exists hoa_org_overlays (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  hoa_spine_id uuid not null references hoa_spine(id) on delete cascade,
  coi_named_insured text,
  coi_expires_on date,
  coi_storage_path text,
  arc_form_storage_path text,
  arc_form_file_name text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, hoa_spine_id)
);

create index if not exists hoa_org_overlays_org_idx on hoa_org_overlays (org_id);

alter table hoa_spine enable row level security;
alter table hoa_org_overlays enable row level security;

drop policy if exists "authenticated read hoa spine" on hoa_spine;
create policy "authenticated read hoa spine" on hoa_spine
  for select to authenticated using (true);

-- Platform admins / service role handle writes to the spine from /admin.
drop policy if exists "platform write hoa spine" on hoa_spine;
create policy "platform write hoa spine" on hoa_spine
  for all to authenticated
  using (exists (select 1 from platform_admins pa where pa.user_id = auth.uid()))
  with check (exists (select 1 from platform_admins pa where pa.user_id = auth.uid()));

drop policy if exists "org members read own hoa overlay" on hoa_org_overlays;
create policy "org members read own hoa overlay" on hoa_org_overlays
  for select to authenticated
  using (exists (
    select 1 from organization_members m
    where m.org_id = hoa_org_overlays.org_id and m.user_id = auth.uid()
  ));

drop policy if exists "org members write own hoa overlay" on hoa_org_overlays;
create policy "org members write own hoa overlay" on hoa_org_overlays
  for all to authenticated
  using (exists (
    select 1 from organization_members m
    where m.org_id = hoa_org_overlays.org_id and m.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from organization_members m
    where m.org_id = hoa_org_overlays.org_id and m.user_id = auth.uid()
  ));

-- Seed spine from the existing template catalog (once).
insert into hoa_spine (name, mgmt_co, contact_name, phone, email, address, qualifications, notes)
select distinct on (lower(trim(name)))
  name, mgmt_co, contact_name, phone, email, address, qualifications, notes
from template_hoas
order by lower(trim(name)), id
on conflict do nothing;

-- New organizations: stages + product approvals + forms only. No HOA clone.
create or replace function seed_org_reference_data(p_org_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  insert into product_approvals (org_id, type, manufacturer, series, noa, pos, neg, trade)
  select p_org_id, type, manufacturer, series, noa, pos, neg, trade
  from template_product_approvals;

  insert into requirements_forms (org_id, jurisdiction, title, notes, file_name, file_data, county, jurisdiction_code, doc_type, trade, field_mapping)
  select p_org_id, jurisdiction, title, notes, file_name, file_data, county, jurisdiction_code, doc_type, trade, field_mapping
  from template_requirements_forms;
end;
$$;
