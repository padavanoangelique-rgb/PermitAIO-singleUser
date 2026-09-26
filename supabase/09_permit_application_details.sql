-- Adds the data fields needed to fill Florida county Uniform Building Permit
-- Applications (Broward, Miami-Dade, and Palm Beach all use a near-identical
-- form) that cannot be derived from the existing jobs / contractor_profiles
-- tables. Split into:
--   1. Company-level fields on contractor_profiles (qualifier, license
--      exemption, business tax receipt, bonding company, split city/state/zip)
--      — these rarely change per job, so they're set once per contractor and
--      reused across every job's Forms Generator output.
--   2. A new job_permit_details table (1:1 with jobs) for everything that
--      genuinely varies per job: property/owner specifics, legal description,
--      flood zone, construction classification, description of work, and the
--      rarely-used architect/bonding/fee-simple-titleholder/mortgage-lender
--      sections some permit applications also ask for.

alter table contractor_profiles
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists zip text,
  add column if not exists qualifier_name text,
  add column if not exists business_tax_receipt_number text,
  add column if not exists bonding_company text,
  add column if not exists bonding_address text,
  add column if not exists bonding_city text,
  add column if not exists bonding_state text,
  add column if not exists bonding_zip text;

create table if not exists job_permit_details (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null unique references jobs(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  unit text,
  legal_description text,
  flood_zone text,
  bfe text,
  floor_area text,
  building_use text,
  construction_type text,
  occupancy_group text,
  present_use text,
  proposed_use text,
  description_of_work text,
  work_type text,
  work_type_other text,
  owner_phone text,
  owner_email text,
  owner_builder boolean not null default false,
  license_exempted boolean not null default false,
  private_provider boolean not null default false,
  owner_authorized_private_provider boolean not null default false,
  architect_name text,
  architect_phone text,
  architect_email text,
  architect_address text,
  architect_city text,
  architect_state text,
  architect_zip text,
  fee_simple_titleholder_name text,
  fee_simple_city text,
  fee_simple_state text,
  fee_simple_zip text,
  mortgage_lender_name text,
  mortgage_lender_address text,
  mortgage_city text,
  mortgage_state text,
  mortgage_zip text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table job_permit_details enable row level security;

create policy "members can read job_permit_details"
  on job_permit_details for select
  using (is_org_member(org_id));

create policy "members can write job_permit_details"
  on job_permit_details for all
  using (is_org_member(org_id))
  with check (is_org_member(org_id));

create index if not exists job_permit_details_org_id_idx on job_permit_details(org_id);

create trigger job_permit_details_set_updated_at
  before update on job_permit_details
  for each row execute function set_updated_at();
