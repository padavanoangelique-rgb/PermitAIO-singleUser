-- ============================================================================
-- PermitAIO — consolidated multi-tenant schema
-- ============================================================================
-- Design notes:
--  * Every tenant-scoped table carries an `org_id` and is protected by RLS
--    so one organization can never see another's rows.
--  * The `jobs` table plays the same role as ezPermitBuilder / Permit
--    Inventory / HOA Tracker's own job concepts, but is now the single
--    "Job #" that ties floor plans, permit tracking, HOA tracking, forms,
--    NOAs, and documents together. Its columns intentionally mirror the
--    original Permit Inventory `jobs` table field-for-field so existing
--    reports/logic translate directly.
--  * `product_approvals` / `requirements_forms` (ezPermitBuilder) and
--    `hoas` (HOA Tracker) keep their original column sets exactly —
--    only `org_id` was added so each tenant gets an isolated copy of the
--    same shared-database pattern they already had.
--  * `hoa_jobs` / `hoa_documents` mirror HOA Tracker's original `jobs` /
--    `documents` tables (renamed only to avoid colliding with the new
--    central `jobs` table) with one additive column, `job_id`, linking
--    an HOA submission back to its central Job #.
-- ============================================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- 1. Organizations & membership
-- ---------------------------------------------------------------------------

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  plan text not null default 'trial' check (plan in ('trial','starter','growth','pro')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists organization_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member')),
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);

create index if not exists idx_org_members_user on organization_members (user_id);
create index if not exists idx_org_members_org on organization_members (org_id);

-- Helper functions used throughout RLS policies below.
create or replace function is_org_member(check_org_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from organization_members
    where org_id = check_org_id and user_id = auth.uid()
  );
$$;

create or replace function is_org_admin(check_org_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from organization_members
    where org_id = check_org_id and user_id = auth.uid() and role in ('owner','admin')
  );
$$;

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_orgs_updated_at on organizations;
create trigger trg_orgs_updated_at before update on organizations
  for each row execute function set_updated_at();

alter table organizations enable row level security;
alter table organization_members enable row level security;

create policy "members can read their org" on organizations
  for select using (is_org_member(id));
create policy "owners/admins can update their org" on organizations
  for update using (is_org_admin(id));
create policy "any authenticated user can create an org" on organizations
  for insert to authenticated with check (true);

create policy "members can read their org roster" on organization_members
  for select using (is_org_member(org_id));
create policy "owners/admins can manage members" on organization_members
  for all using (is_org_admin(org_id)) with check (is_org_admin(org_id));
create policy "user can insert themself as first owner" on organization_members
  for insert to authenticated with check (
    user_id = auth.uid()
    and not exists (select 1 from organization_members m where m.org_id = organization_members.org_id)
  );

-- ---------------------------------------------------------------------------
-- 2. Stages (board columns) — Permit Inventory, unchanged field set
-- ---------------------------------------------------------------------------

create table if not exists stages (
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  sort_order int not null,
  primary key (org_id, name)
);

alter table stages enable row level security;
create policy "members can read stages" on stages for select using (is_org_member(org_id));
create policy "members can write stages" on stages for all using (is_org_member(org_id)) with check (is_org_member(org_id));

create or replace function seed_default_stages(target_org uuid)
returns void language plpgsql as $$
begin
  insert into stages (org_id, name, sort_order) values
    (target_org, 'Need Permit Submittal', 1),
    (target_org, 'Needs Permit/HOA Submittal', 2),
    (target_org, 'Needs HOA Submittal', 3),
    (target_org, 'RF Pending Permit', 4),
    (target_org, 'Awaiting HOA', 5),
    (target_org, 'In Review', 6),
    (target_org, 'Ready to Order', 7),
    (target_org, 'Ordered', 8),
    (target_org, 'Awaiting Parts', 9),
    (target_org, 'Product Arrived - Needs Permit', 10),
    (target_org, 'Partial Product Arrived', 11),
    (target_org, 'Product Arrived', 12),
    (target_org, 'RF Ready for Install', 13),
    (target_org, 'Scheduled for Install', 14),
    (target_org, 'Install Started', 15),
    (target_org, 'In Progress', 16),
    (target_org, 'Needs Final Inspection', 17),
    (target_org, 'Scheduled Final Inspection', 18),
    (target_org, 'Inspected', 19),
    (target_org, 'Pending Change Order Windows', 20),
    (target_org, 'Open Service', 21),
    (target_org, 'Sales Manager Escalation', 22)
  on conflict (org_id, name) do nothing;
end;
$$;

-- When an organization is created, seed its stage board automatically.
create or replace function handle_new_organization()
returns trigger language plpgsql as $$
begin
  perform seed_default_stages(new.id);
  return new;
end;
$$;

drop trigger if exists trg_new_org_seed_stages on organizations;
create trigger trg_new_org_seed_stages after insert on organizations
  for each row execute function handle_new_organization();

-- ---------------------------------------------------------------------------
-- 3. Jobs — the central Job # hub (mirrors Permit Inventory jobs 1:1 + org_id)
-- ---------------------------------------------------------------------------

create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  client_name text not null,
  job_number text not null,
  sale_date date,
  trade_type text,
  contract_value numeric,
  permit_number text,
  jurisdiction text,
  address text,
  folio_number text,
  sub_status text not null default 'Need to Submit'
    check (sub_status in (
      'Need to Submit','In Review','Approved','Approved and Printed','Complete'
    )),
  stage text not null default 'Need Permit Submittal',
  assigned_date date,
  submitted_date date,
  approved_date date,
  noc_date date,
  permit_tech text not null default 'Permit Tech 1',
  noc_status text not null default 'None' check (noc_status in ('None','Pending','Submitted','Recorded')),
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, job_number)
);

create index if not exists idx_jobs_org_stage on jobs (org_id, stage);
create index if not exists idx_jobs_org_lookup on jobs (org_id, job_number, client_name, permit_number);

drop trigger if exists trg_jobs_updated_at on jobs;
create trigger trg_jobs_updated_at before update on jobs
  for each row execute function set_updated_at();

alter table jobs enable row level security;
create policy "members can read jobs" on jobs for select using (is_org_member(org_id));
create policy "members can insert jobs" on jobs for insert to authenticated with check (is_org_member(org_id));
create policy "members can update jobs" on jobs for update using (is_org_member(org_id)) with check (is_org_member(org_id));
create policy "admins can delete jobs" on jobs for delete using (is_org_admin(org_id));

-- Job attachments (Documents tab) — mirrors Permit Inventory's job_files
create table if not exists job_files (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  job_id uuid not null references jobs(id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  size_bytes bigint,
  category text default 'general',
  uploaded_by uuid references auth.users(id),
  uploaded_at timestamptz not null default now()
);

create index if not exists idx_job_files_job on job_files (job_id);
alter table job_files enable row level security;
create policy "members can read job files" on job_files for select using (is_org_member(org_id));
create policy "members can add job files" on job_files for insert to authenticated with check (is_org_member(org_id));
create policy "members can delete job files" on job_files for delete using (is_org_member(org_id));

-- Activity & Notes tab
create table if not exists job_activity (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  job_id uuid not null references jobs(id) on delete cascade,
  user_id uuid references auth.users(id),
  activity_type text not null default 'note' check (activity_type in ('note','status_change','file','system')),
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_job_activity_job on job_activity (job_id);
alter table job_activity enable row level security;
create policy "members can read job activity" on job_activity for select using (is_org_member(org_id));
create policy "members can add job activity" on job_activity for insert to authenticated with check (is_org_member(org_id));

-- ---------------------------------------------------------------------------
-- 4. Floor Plans (ezPermitBuilder) — additive persistence tied to a Job
--    The floor-plan-creator.html tool itself is unchanged; this table only
--    adds save/load + shared Product Approval + Requirements Forms data.
-- ---------------------------------------------------------------------------

create table if not exists floor_plans (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  job_id uuid references jobs(id) on delete cascade,
  name text not null default 'Floor Plan',
  plan_data jsonb not null default '{}'::jsonb,
  version int not null default 1,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_floor_plans_job on floor_plans (job_id);
drop trigger if exists trg_floor_plans_updated_at on floor_plans;
create trigger trg_floor_plans_updated_at before update on floor_plans
  for each row execute function set_updated_at();

alter table floor_plans enable row level security;
create policy "members can read floor plans" on floor_plans for select using (is_org_member(org_id));
create policy "members can write floor plans" on floor_plans for all using (is_org_member(org_id)) with check (is_org_member(org_id));

-- Shared Product Approval Database — same columns as the original app, org-scoped.
create table if not exists product_approvals (
  id bigint generated always as identity primary key,
  org_id uuid not null references organizations(id) on delete cascade,
  type text not null,
  manufacturer text not null,
  series text not null,
  noa text,
  pos numeric,
  neg numeric,
  created_at timestamptz not null default now()
);

create index if not exists idx_product_approvals_org on product_approvals (org_id);
alter table product_approvals enable row level security;
create policy "members can read product approvals" on product_approvals for select using (is_org_member(org_id));
create policy "members can write product approvals" on product_approvals for all using (is_org_member(org_id)) with check (is_org_member(org_id));

-- Requirements & Forms library — same columns as the original app, org-scoped,
-- plus two additive columns so the Forms Generator can auto-match by county
-- and folio jurisdiction code without touching the original fields.
create table if not exists requirements_forms (
  id bigint generated always as identity primary key,
  org_id uuid not null references organizations(id) on delete cascade,
  jurisdiction text not null,
  title text not null,
  notes text,
  file_name text,
  file_data text,
  county text,
  jurisdiction_code text,
  created_at timestamptz not null default now()
);

create index if not exists idx_requirements_forms_org on requirements_forms (org_id);
alter table requirements_forms enable row level security;
create policy "members can read requirements forms" on requirements_forms for select using (is_org_member(org_id));
create policy "members can write requirements forms" on requirements_forms for all using (is_org_member(org_id)) with check (is_org_member(org_id));

-- ---------------------------------------------------------------------------
-- 5. Folio jurisdiction codes — public reference data (not org-scoped)
-- ---------------------------------------------------------------------------

create table if not exists folio_jurisdiction_codes (
  id bigint generated always as identity primary key,
  county text not null,
  code text not null,
  jurisdiction_name text not null,
  notes text,
  unique (county, code)
);

alter table folio_jurisdiction_codes enable row level security;
create policy "anyone authenticated can read folio codes" on folio_jurisdiction_codes
  for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- 6. NOA library (NOA Downloader) — additive, empty by default
-- ---------------------------------------------------------------------------

create table if not exists noa_library (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  manufacturer text not null,
  series text,
  noa_number text not null,
  file_name text,
  storage_path text,
  effective_date date,
  expiration_date date,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_noa_library_org on noa_library (org_id);
create index if not exists idx_noa_library_lookup on noa_library (org_id, manufacturer, series, noa_number);
alter table noa_library enable row level security;
create policy "members can read noa library" on noa_library for select using (is_org_member(org_id));
create policy "members can write noa library" on noa_library for all using (is_org_member(org_id)) with check (is_org_member(org_id));

-- ---------------------------------------------------------------------------
-- 7. HOA Tracker — same columns as the original app, org-scoped.
--    `jobs`/`documents` renamed to `hoa_jobs`/`hoa_documents` only to avoid
--    colliding with the new central `jobs` table; one additive `job_id`
--    column links an HOA submission to its central Job #.
-- ---------------------------------------------------------------------------

create table if not exists hoas (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  mgmt_co text default '',
  contact_name text default '',
  phone text default '',
  email text default '',
  address text default '',
  qualifications text default '',
  notes text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_hoas_org on hoas (org_id);
drop trigger if exists trg_hoas_updated on hoas;
create trigger trg_hoas_updated before update on hoas
  for each row execute procedure set_updated_at();

alter table hoas enable row level security;
create policy "members can read hoas" on hoas for select using (is_org_member(org_id));
create policy "members can write hoas" on hoas for all using (is_org_member(org_id)) with check (is_org_member(org_id));

create table if not exists hoa_jobs (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  hoa_id uuid references hoas(id) on delete cascade,
  job_id uuid references jobs(id) on delete set null,
  job_number text default '',
  job_name text default '',
  address text not null,
  status text default 'Need to Submit',
  assigned_to text default '',
  assigned_date date,
  date_submitted date,
  date_approved date,
  notes text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_hoa_jobs_org on hoa_jobs (org_id);
create index if not exists idx_hoa_jobs_assigned_to on hoa_jobs (assigned_to);
create index if not exists idx_hoa_jobs_hoa on hoa_jobs (hoa_id);
create index if not exists idx_hoa_jobs_job on hoa_jobs (job_id);
drop trigger if exists trg_hoa_jobs_updated on hoa_jobs;
create trigger trg_hoa_jobs_updated before update on hoa_jobs
  for each row execute procedure set_updated_at();

alter table hoa_jobs enable row level security;
create policy "members can read hoa jobs" on hoa_jobs for select using (is_org_member(org_id));
create policy "members can write hoa jobs" on hoa_jobs for all using (is_org_member(org_id)) with check (is_org_member(org_id));

create table if not exists hoa_documents (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  hoa_id uuid references hoas(id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  uploaded_at timestamptz default now()
);

create index if not exists idx_hoa_documents_org on hoa_documents (org_id);
alter table hoa_documents enable row level security;
create policy "members can read hoa documents" on hoa_documents for select using (is_org_member(org_id));
create policy "members can write hoa documents" on hoa_documents for all using (is_org_member(org_id)) with check (is_org_member(org_id));

-- ---------------------------------------------------------------------------
-- 8. Permit Package Generator — version history of generated ZIP bundles
-- ---------------------------------------------------------------------------

create table if not exists permit_packages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  job_id uuid not null references jobs(id) on delete cascade,
  version int not null default 1,
  storage_path text,
  manifest jsonb not null default '{}'::jsonb,
  generated_by uuid references auth.users(id),
  generated_at timestamptz not null default now()
);

create index if not exists idx_permit_packages_job on permit_packages (job_id);
alter table permit_packages enable row level security;
create policy "members can read permit packages" on permit_packages for select using (is_org_member(org_id));
create policy "members can write permit packages" on permit_packages for all using (is_org_member(org_id)) with check (is_org_member(org_id));

-- ---------------------------------------------------------------------------
-- 9. Storage buckets
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public) values ('job-files', 'job-files', false) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('hoa-documents', 'hoa-documents', false) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('noa-library', 'noa-library', false) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('permit-packages', 'permit-packages', false) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('requirements-forms', 'requirements-forms', false) on conflict (id) do nothing;

create policy "members read job-files objects" on storage.objects for select to authenticated
  using (bucket_id = 'job-files');
create policy "members write job-files objects" on storage.objects for insert to authenticated
  with check (bucket_id = 'job-files');
create policy "members delete job-files objects" on storage.objects for delete to authenticated
  using (bucket_id = 'job-files');

create policy "members read hoa-documents objects" on storage.objects for select to authenticated
  using (bucket_id = 'hoa-documents');
create policy "members write hoa-documents objects" on storage.objects for insert to authenticated
  with check (bucket_id = 'hoa-documents');
create policy "members delete hoa-documents objects" on storage.objects for delete to authenticated
  using (bucket_id = 'hoa-documents');

create policy "members read noa-library objects" on storage.objects for select to authenticated
  using (bucket_id = 'noa-library');
create policy "members write noa-library objects" on storage.objects for insert to authenticated
  with check (bucket_id = 'noa-library');
create policy "members delete noa-library objects" on storage.objects for delete to authenticated
  using (bucket_id = 'noa-library');

create policy "members read permit-packages objects" on storage.objects for select to authenticated
  using (bucket_id = 'permit-packages');
create policy "members write permit-packages objects" on storage.objects for insert to authenticated
  with check (bucket_id = 'permit-packages');

create policy "members read requirements-forms objects" on storage.objects for select to authenticated
  using (bucket_id = 'requirements-forms');
create policy "members write requirements-forms objects" on storage.objects for insert to authenticated
  with check (bucket_id = 'requirements-forms');
