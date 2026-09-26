-- Agent architecture: corrections library, versioned library entries,
-- human gate for interpretations, Permit Scout pulls, HOA Scout notes,
-- and public NOC / portal routing on the building-department packet.
-- Run in the Supabase SQL editor. Does not touch email ingest.

-- ---------------------------------------------------------------------------
-- Building department packet: where the NOC goes, and the public portal.
-- ---------------------------------------------------------------------------

alter table public.platform_registration_packets
  add column if not exists public_portal_url text,
  add column if not exists noc_route text,
  add column if not exists noc_route_target text;

alter table public.platform_registration_packets
  drop constraint if exists platform_registration_packets_noc_route_check;

alter table public.platform_registration_packets
  add constraint platform_registration_packets_noc_route_check
  check (noc_route is null or noc_route in ('email', 'portal', 'address'));

-- ---------------------------------------------------------------------------
-- Corrections library. Job-scoped by default. A repeated mistake can be
-- flagged as a jurisdiction lesson. status held = knowledge check pulled it
-- before a desk can quote it.
-- ---------------------------------------------------------------------------

create table if not exists public.corrections_library (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  jurisdiction text,
  correction text not null,
  resolution text,
  job_id uuid references public.jobs(id) on delete set null,
  job_number text,
  cross_ref text,
  original_submission text,
  approval_ground_truth text,
  scope text not null default 'job' check (scope in ('job', 'jurisdiction')),
  status text not null default 'published' check (status in ('draft', 'published', 'held', 'retired')),
  version bigint not null default 1,
  created_by uuid references auth.users(id),
  author_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_corrections_library_org
  on public.corrections_library (org_id, status, jurisdiction);

alter table public.corrections_library enable row level security;

drop policy if exists "members read corrections library" on public.corrections_library;
create policy "members read corrections library" on public.corrections_library
  for select using (is_org_member(org_id));

drop policy if exists "members write corrections library" on public.corrections_library;
create policy "members write corrections library" on public.corrections_library
  for all using (is_org_member(org_id)) with check (is_org_member(org_id));

-- ---------------------------------------------------------------------------
-- Every library write keeps a snapshot so a bad entry can be traced
-- and put back. org_id is null for platform building-department packets.
-- ---------------------------------------------------------------------------

create table if not exists public.library_entry_versions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  library text not null,
  entry_id text not null,
  version bigint not null,
  snapshot jsonb not null,
  change_note text,
  author_id uuid references auth.users(id),
  author_label text,
  created_at timestamptz not null default now(),
  unique (library, entry_id, version)
);

create index if not exists idx_library_versions_entry
  on public.library_entry_versions (library, entry_id, version desc);

alter table public.library_entry_versions enable row level security;

drop policy if exists "members read library versions" on public.library_entry_versions;
create policy "members read library versions" on public.library_entry_versions
  for select using (org_id is null or is_org_member(org_id));

drop policy if exists "members write library versions" on public.library_entry_versions;
create policy "members write library versions" on public.library_entry_versions
  for all using (org_id is not null and is_org_member(org_id))
  with check (org_id is not null and is_org_member(org_id));

-- ---------------------------------------------------------------------------
-- Interpretations wait here. Facts (notes, dates, Scout pulls) do not.
-- ---------------------------------------------------------------------------

create table if not exists public.proposed_updates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  library text not null,
  entry_id text,
  kind text not null check (kind in ('research_report', 'library_correction', 'weekly_self_update')),
  proposed jsonb not null,
  previous jsonb,
  why text not null,
  author_id uuid references auth.users(id),
  author_label text,
  status text not null default 'pending' check (status in ('pending', 'added', 'skipped')),
  decided_by uuid references auth.users(id),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_proposed_updates_org
  on public.proposed_updates (org_id, status, created_at desc);

alter table public.proposed_updates enable row level security;

drop policy if exists "members read proposed updates" on public.proposed_updates;
create policy "members read proposed updates" on public.proposed_updates
  for select using (is_org_member(org_id));

drop policy if exists "members write proposed updates" on public.proposed_updates;
create policy "members write proposed updates" on public.proposed_updates
  for all using (is_org_member(org_id)) with check (is_org_member(org_id));

-- ---------------------------------------------------------------------------
-- Permit Scout audit + in-flight marker. Notes themselves live on the job.
-- ---------------------------------------------------------------------------

create table if not exists public.permit_scout_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  permit_number text,
  state text not null check (state in ('running', 'done', 'failed')),
  status_found text,
  note text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists idx_permit_scout_runs_job
  on public.permit_scout_runs (org_id, job_id, started_at desc);

alter table public.permit_scout_runs enable row level security;

drop policy if exists "members read permit scout runs" on public.permit_scout_runs;
create policy "members read permit scout runs" on public.permit_scout_runs
  for select using (is_org_member(org_id));

-- ---------------------------------------------------------------------------
-- HOA Scout findings. The desk reads these. It does not invent them.
-- ---------------------------------------------------------------------------

create table if not exists public.hoa_scout_findings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  hoa_id uuid references public.hoas(id) on delete set null,
  job_id uuid references public.jobs(id) on delete set null,
  job_number text,
  association text,
  note text not null,
  observed_on date,
  source_url text,
  created_at timestamptz not null default now()
);

create index if not exists idx_hoa_scout_org
  on public.hoa_scout_findings (org_id, association);

alter table public.hoa_scout_findings enable row level security;

drop policy if exists "members read hoa scout" on public.hoa_scout_findings;
create policy "members read hoa scout" on public.hoa_scout_findings
  for select using (is_org_member(org_id));

drop policy if exists "members write hoa scout" on public.hoa_scout_findings;
create policy "members write hoa scout" on public.hoa_scout_findings
  for all using (is_org_member(org_id)) with check (is_org_member(org_id));

-- ---------------------------------------------------------------------------
-- Notification source list. Keep every source the app already writes,
-- and add permit_scout. Deduped in the worker, not by a unique index,
-- because the same job can later change status.
-- ---------------------------------------------------------------------------

do $$
declare cname text;
begin
  select con.conname into cname
  from pg_constraint con
  where con.conrelid = 'public.notifications'::regclass
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%source%';
  if cname is not null then
    execute format('alter table public.notifications drop constraint %I', cname);
  end if;
end $$;

alter table public.notifications
  add constraint notifications_source_check
  check (source in (
    'data_agent',
    'permits_agent',
    'bulk_agent',
    'intake_agent',
    'sheet_agent',
    'email_agent',
    'team_request',
    'install_assign',
    'runner_assign',
    'user_message',
    'job_task_assign',
    'permit_scout'
  ));
