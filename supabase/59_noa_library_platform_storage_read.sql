-- Any signed-in user can read a noa-library storage object when the
-- noa_library row pointing at it is a platform (shared) row -- mirrors the
-- existing "read platform rows" policy on public.noa_library itself.
-- Previously only members of the org whose folder the file physically
-- lives under could read it, so platform NOAs uploaded under one org's
-- folder (e.g. Guardian) 404'd for every other org, surfacing as
-- "storage error: Object not found" in the permit-package ZIP builder.
create policy "read platform noa-library objects"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'noa-library'
    and exists (
      select 1
      from public.noa_library l
      where l.storage_path = storage.objects.name
        and l.visibility = 'platform'
    )
  );
