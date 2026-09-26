/**
 * HOA main frame + company drawer.
 *
 * hoa_spine     — shared. Search this. 5k rows stay in Postgres.
 * hoa_org_overlays — Premier COI/ARC for that HOA. Guardian does not see it.
 *
 * Search never selects * from the spine. Limit after county/city/name filters.
 */

export const HOA_SEARCH_LIMIT = 40;

export const HOA_SPINE_SQL = `create extension if not exists pg_trgm;

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
create index if not exists hoa_spine_name_trgm_idx on public.hoa_spine using gin (name gin_trgm_ops);`;

export type HoaSpineCard = {
  id: string;
  name: string;
  city: string | null;
  county: string | null;
  mgmt_co: string | null;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
};

export type HoaOrgOverlay = {
  hoa_spine_id: string;
  org_id: string;
  coi_expires_on: string | null;
  coi_storage_path: string | null;
  arc_form_storage_path: string | null;
  arc_form_file_name: string | null;
  notes: string | null;
};

export function spineSearchFilter(query: string): string {
  return query.trim().replace(/[%_]/g, " ").slice(0, 80);
}

export type HoaSpineSeedRow = {
  name: string;
  county: string;
  city: string | null;
  mgmt_co: string | null;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
};
