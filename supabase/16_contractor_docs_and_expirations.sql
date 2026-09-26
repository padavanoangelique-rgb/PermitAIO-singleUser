-- Contractor profile expirations + file uploads.
-- Run in the Supabase SQL editor if these objects are not already live.

alter table contractor_profiles
  add column if not exists license_expires date,
  add column if not exists insurance_expires date,
  add column if not exists workers_comp_expires date,
  add column if not exists btr_expires date;

create table if not exists contractor_files (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  contractor_id uuid not null references contractor_profiles(id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  size_bytes integer,
  label text,
  expires_on date,
  uploaded_at timestamptz not null default now()
);

create index if not exists idx_contractor_files_contractor on contractor_files (contractor_id);

alter table contractor_files enable row level security;

drop policy if exists "members read contractor_files" on contractor_files;
create policy "members read contractor_files" on contractor_files
  for select using (is_org_member(org_id));

drop policy if exists "members insert contractor_files" on contractor_files;
create policy "members insert contractor_files" on contractor_files
  for insert to authenticated with check (is_org_member(org_id));

drop policy if exists "members delete contractor_files" on contractor_files;
create policy "members delete contractor_files" on contractor_files
  for delete using (is_org_member(org_id));

insert into storage.buckets (id, name, public)
values ('contractor-docs', 'contractor-docs', false)
on conflict (id) do nothing;

drop policy if exists "members read contractor-docs objects" on storage.objects;
create policy "members read contractor-docs objects" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'contractor-docs'
    and exists (
      select 1 from contractor_profiles c
      where c.id = ((string_to_array(name, '/'))[1])::uuid
        and is_org_member(c.org_id)
    )
  );

drop policy if exists "members write contractor-docs objects" on storage.objects;
create policy "members write contractor-docs objects" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'contractor-docs'
    and exists (
      select 1 from contractor_profiles c
      where c.id = ((string_to_array(name, '/'))[1])::uuid
        and is_org_member(c.org_id)
    )
  );

drop policy if exists "members delete contractor-docs objects" on storage.objects;
create policy "members delete contractor-docs objects" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'contractor-docs'
    and exists (
      select 1 from contractor_profiles c
      where c.id = ((string_to_array(name, '/'))[1])::uuid
        and is_org_member(c.org_id)
    )
  );
