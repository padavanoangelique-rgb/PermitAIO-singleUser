-- Per-job fee tracking (NOC / permit / engineering fees, etc.) + PDF/photo
-- receipt uploads, for internal recordkeeping inside Permit Inventory only.
-- This is purely additive: it does not touch the jobs table, job_files
-- table, or any existing Permit Inventory field/report. Categories are
-- free text (contractor's choice) rather than a fixed enum. Fee reports are
-- generated client-side from this table and are not surfaced anywhere else
-- in the app's data or reporting.

create table if not exists job_fees (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  job_id uuid not null references jobs(id) on delete cascade,
  category text not null,
  amount numeric(10, 2) not null check (amount >= 0),
  paid_date date not null default current_date,
  jurisdiction text,
  notes text,
  receipt_storage_path text,
  receipt_file_name text,
  receipt_mime_type text,
  receipt_size_bytes bigint,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_job_fees_job on job_fees (job_id);
create index if not exists idx_job_fees_org_paid_date on job_fees (org_id, paid_date);

alter table job_fees enable row level security;
create policy "members can read job fees" on job_fees for select using (is_org_member(org_id));
create policy "members can add job fees" on job_fees for insert to authenticated with check (is_org_member(org_id));
create policy "members can update job fees" on job_fees for update using (is_org_member(org_id)) with check (is_org_member(org_id));
create policy "members can delete job fees" on job_fees for delete using (is_org_member(org_id));

insert into storage.buckets (id, name, public) values ('job-fee-receipts', 'job-fee-receipts', false) on conflict (id) do nothing;

-- job-fee-receipts: path = `${jobId}/${filename}`, same org-scoping
-- convention established in 08_scope_storage_rls_by_org.sql for job-files.
create policy "members read job-fee-receipts objects" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'job-fee-receipts'
    and exists (
      select 1 from jobs j
      where j.id = ((string_to_array(name, '/'))[1])::uuid
        and is_org_member(j.org_id)
    )
  );

create policy "members write job-fee-receipts objects" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'job-fee-receipts'
    and exists (
      select 1 from jobs j
      where j.id = ((string_to_array(name, '/'))[1])::uuid
        and is_org_member(j.org_id)
    )
  );

create policy "members delete job-fee-receipts objects" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'job-fee-receipts'
    and exists (
      select 1 from jobs j
      where j.id = ((string_to_array(name, '/'))[1])::uuid
        and is_org_member(j.org_id)
    )
  );
