-- Shared South Florida HOA directory. Search by county / city / name.
-- Never load the full table into the app. Run this once in Supabase SQL.

create extension if not exists pg_trgm;

create table if not exists public.hoa_spine (
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

alter table public.hoa_spine add column if not exists city text;
alter table public.hoa_spine add column if not exists county text;

alter table public.hoa_spine enable row level security;

drop policy if exists "authenticated read hoa spine" on public.hoa_spine;
create policy "authenticated read hoa spine" on public.hoa_spine
  for select to authenticated using (true);

drop index if exists public.hoa_spine_name_norm_uidx;
create unique index if not exists hoa_spine_name_county_uidx
  on public.hoa_spine (name_norm, county);

create index if not exists hoa_spine_county_idx on public.hoa_spine (county);
create index if not exists hoa_spine_county_city_idx on public.hoa_spine (county, city);
create index if not exists hoa_spine_city_idx on public.hoa_spine (lower(city));
create index if not exists hoa_spine_name_trgm_idx on public.hoa_spine using gin (name gin_trgm_ops);
