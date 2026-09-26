-- Per-job annotated (marked-up) copies of NOA PDFs. The shared noa_library
-- row + its storage_path stay the pristine template used by every job;
-- this table records, per (job, noa), the job-specific annotated version
-- (blue circles / yellow highlights drawn in-app) that should ship in that
-- job's permit package and NOA downloads instead of the blank original.

create table if not exists job_noa_annotations (
    id uuid primary key default gen_random_uuid(),
    org_id uuid not null references organizations(id) on delete cascade,
    job_id uuid not null references jobs(id) on delete cascade,
    noa_library_id uuid not null references noa_library(id) on delete cascade,
    storage_path text not null,
    annotated_by uuid references auth.users(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (job_id, noa_library_id)
  );

create index if not exists idx_job_noa_annotations_job on job_noa_annotations (job_id);

alter table job_noa_annotations enable row level security;

create policy "members read job_noa_annotations" on job_noa_annotations
for select to authenticated
using (is_org_member(org_id));

create policy "members write job_noa_annotations" on job_noa_annotations
for insert to authenticated
with check (is_org_member(org_id));

create policy "members update job_noa_annotations" on job_noa_annotations
for update to authenticated
using (is_org_member(org_id))
with check (is_org_member(org_id));

create policy "members delete job_noa_annotations" on job_noa_annotations
for delete to authenticated
using (is_org_member(org_id));

-- Storage bucket for the annotated PDFs themselves. Path convention
-- mirrors job-files: `${jobId}/${noaLibraryId}.pdf` -> first path segment
-- is jobs.id, scoped the same way job-files objects are scoped.
insert into storage.buckets (id, name, public)
values ('job-noa-annotations', 'job-noa-annotations', false)
on conflict (id) do nothing;

create policy "members read job-noa-annotations objects" on storage.objects
for select to authenticated
using (
    bucket_id = 'job-noa-annotations'
    and exists (
      select 1 from jobs j
      where j.id = ((string_to_array(name, '/'))[1])::uuid
      and is_org_member(j.org_id)
    )
  );

create policy "members write job-noa-annotations objects" on storage.objects
for insert to authenticated
with check (
    bucket_id = 'job-noa-annotations'
    and exists (
      select 1 from jobs j
      where j.id = ((string_to_array(name, '/'))[1])::uuid
      and is_org_member(j.org_id)
    )
  );

create policy "members update job-noa-annotations objects" on storage.objects
for update to authenticated
using (
    bucket_id = 'job-noa-annotations'
    and exists (
      select 1 from jobs j
      where j.id = ((string_to_array(name, '/'))[1])::uuid
      and is_org_member(j.org_id)
    )
  )
with check (
    bucket_id = 'job-noa-annotations'
    and exists (
      select 1 from jobs j
      where j.id = ((string_to_array(name, '/'))[1])::uuid
      and is_org_member(j.org_id)
    )
  );

create policy "members delete job-noa-annotations objects" on storage.objects
for delete to authenticated
using (
    bucket_id = 'job-noa-annotations'
    and exists (
      select 1 from jobs j
      where j.id = ((string_to_array(name, '/'))[1])::uuid
      and is_org_member(j.org_id)
    )
  );
