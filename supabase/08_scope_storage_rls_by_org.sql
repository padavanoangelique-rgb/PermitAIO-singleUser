-- Fix cross-tenant storage exposure: previous policies only checked bucket_id,
-- so any authenticated user (any org) could read/write/delete any other org's
-- files in hoa-documents, job-files, noa-library, permit-packages, and
-- requirements-forms. This scopes every policy to the requesting user's own
-- org, based on each bucket's established storage path convention.

-- noa-library: path = `${org_id}/${noaEntryId}/${filename}` -> first segment IS the org id.
drop policy if exists "members read noa-library objects" on storage.objects;
drop policy if exists "members write noa-library objects" on storage.objects;
drop policy if exists "members delete noa-library objects" on storage.objects;

create policy "members read noa-library objects" on storage.objects
  for select to authenticated
  using (bucket_id = 'noa-library' and is_org_member(((string_to_array(name, '/'))[1])::uuid));

create policy "members write noa-library objects" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'noa-library' and is_org_member(((string_to_array(name, '/'))[1])::uuid));

create policy "members delete noa-library objects" on storage.objects
  for delete to authenticated
  using (bucket_id = 'noa-library' and is_org_member(((string_to_array(name, '/'))[1])::uuid));

-- job-files: path = `${jobId}/${filename}` -> first segment is jobs.id.
drop policy if exists "members read job-files objects" on storage.objects;
drop policy if exists "members write job-files objects" on storage.objects;
drop policy if exists "members delete job-files objects" on storage.objects;

create policy "members read job-files objects" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'job-files'
    and exists (
      select 1 from jobs j
      where j.id = ((string_to_array(name, '/'))[1])::uuid
        and is_org_member(j.org_id)
    )
  );

create policy "members write job-files objects" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'job-files'
    and exists (
      select 1 from jobs j
      where j.id = ((string_to_array(name, '/'))[1])::uuid
        and is_org_member(j.org_id)
    )
  );

create policy "members delete job-files objects" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'job-files'
    and exists (
      select 1 from jobs j
      where j.id = ((string_to_array(name, '/'))[1])::uuid
        and is_org_member(j.org_id)
    )
  );

-- hoa-documents: path = `${hoaId}/${filename}` -> first segment is hoas.id.
drop policy if exists "members read hoa-documents objects" on storage.objects;
drop policy if exists "members write hoa-documents objects" on storage.objects;
drop policy if exists "members delete hoa-documents objects" on storage.objects;

create policy "members read hoa-documents objects" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'hoa-documents'
    and exists (
      select 1 from hoas h
      where h.id = ((string_to_array(name, '/'))[1])::uuid
        and is_org_member(h.org_id)
    )
  );

create policy "members write hoa-documents objects" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'hoa-documents'
    and exists (
      select 1 from hoas h
      where h.id = ((string_to_array(name, '/'))[1])::uuid
        and is_org_member(h.org_id)
    )
  );

create policy "members delete hoa-documents objects" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'hoa-documents'
    and exists (
      select 1 from hoas h
      where h.id = ((string_to_array(name, '/'))[1])::uuid
        and is_org_member(h.org_id)
    )
  );

-- permit-packages and requirements-forms: not yet wired up in app code (0 objects
-- today). Scope them defensively now using the same "first path segment = org_id"
-- convention as noa-library, so the feature is safe by default whenever it ships.
drop policy if exists "members read permit-packages objects" on storage.objects;
drop policy if exists "members write permit-packages objects" on storage.objects;
drop policy if exists "members delete permit-packages objects" on storage.objects;

create policy "members read permit-packages objects" on storage.objects
  for select to authenticated
  using (bucket_id = 'permit-packages' and is_org_member(((string_to_array(name, '/'))[1])::uuid));

create policy "members write permit-packages objects" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'permit-packages' and is_org_member(((string_to_array(name, '/'))[1])::uuid));

create policy "members delete permit-packages objects" on storage.objects
  for delete to authenticated
  using (bucket_id = 'permit-packages' and is_org_member(((string_to_array(name, '/'))[1])::uuid));

drop policy if exists "members read requirements-forms objects" on storage.objects;
drop policy if exists "members write requirements-forms objects" on storage.objects;

create policy "members read requirements-forms objects" on storage.objects
  for select to authenticated
  using (bucket_id = 'requirements-forms' and is_org_member(((string_to_array(name, '/'))[1])::uuid));

create policy "members write requirements-forms objects" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'requirements-forms' and is_org_member(((string_to_array(name, '/'))[1])::uuid));
