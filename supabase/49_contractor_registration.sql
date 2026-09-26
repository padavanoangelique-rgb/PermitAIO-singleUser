-- Contractor registration packets (platform library), typed contractor
-- files, and public NOC upload tokens.
-- Run in the Supabase SQL editor if these objects are not already live.

alter table contractor_files
  add column if not exists kind text default 'other';

drop policy if exists "members update contractor_files" on contractor_files;
create policy "members update contractor_files" on contractor_files
  for update using (is_org_member(org_id))
  with check (is_org_member(org_id));

create table if not exists platform_registration_packets (
  id uuid primary key default gen_random_uuid(),
  county text,
  jurisdiction text not null unique,
  building_department text,
  building_dept_email text,
  instructions text,
  registration_subject text,
  registration_body text,
  noc_subject text,
  noc_body text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists platform_registration_docs (
  id uuid primary key default gen_random_uuid(),
  packet_id uuid not null references platform_registration_packets(id) on delete cascade,
  title text not null,
  kind text not null default 'registration',
  file_name text,
  file_data text,
  created_at timestamptz not null default now()
);

create table if not exists contractor_noc_tokens (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  contractor_id uuid not null references contractor_profiles(id) on delete cascade,
  token text not null unique,
  created_at timestamptz not null default now(),
  used_at timestamptz
);

create index if not exists idx_platform_reg_docs_packet on platform_registration_docs (packet_id);
create index if not exists idx_contractor_noc_tokens_token on contractor_noc_tokens (token);

alter table platform_registration_packets enable row level security;
alter table platform_registration_docs enable row level security;
alter table contractor_noc_tokens enable row level security;

drop policy if exists "members read packets" on platform_registration_packets;
create policy "members read packets" on platform_registration_packets
  for select to authenticated using (true);

drop policy if exists "members read packet docs" on platform_registration_docs;
create policy "members read packet docs" on platform_registration_docs
  for select to authenticated using (true);

drop policy if exists "members read noc tokens" on contractor_noc_tokens;
create policy "members read noc tokens" on contractor_noc_tokens
  for select using (is_org_member(org_id));

drop policy if exists "members insert noc tokens" on contractor_noc_tokens;
create policy "members insert noc tokens" on contractor_noc_tokens
  for insert to authenticated with check (is_org_member(org_id));
