-- Job-level scan tokens: one QR sticker per job, reused for any scan
-- purpose (permit custody today, warehouse job identification too) rather
-- than a token tied to one feature. Created lazily the first time a
-- sticker is printed for that job, not backfilled for every job up front.
create table if not exists public.job_scan_tokens (
  job_id uuid primary key references public.jobs(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now()
);
create index if not exists idx_job_scan_tokens_org on public.job_scan_tokens (org_id);

-- Printed-permit custody: tracks the physical permit packet as it moves
-- library -> checked out -> checked in. One row per job (a job has one
-- permit packet for this feature's scope, even if the job covers several
-- individual permit types).
create table if not exists public.permit_custody (
  job_id uuid primary key references public.jobs(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  status text not null default 'not_printed'
    check (status in ('not_printed', 'in_library', 'checked_out', 'checked_in')),
  current_holder_id uuid references auth.users(id),
  current_holder_name text,
  printed_at timestamptz,
  checked_out_at timestamptz,
  checked_in_at timestamptz,
  updated_at timestamptz not null default now()
);
create index if not exists idx_permit_custody_org on public.permit_custody (org_id);

-- Append-only history so "who had it when" is always answerable, even
-- though the current-state table above only tracks the latest holder.
create table if not exists public.permit_custody_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  event_type text not null check (event_type in ('printed', 'checked_out', 'checked_in')),
  actor_id uuid references auth.users(id),
  actor_name text,
  created_at timestamptz not null default now()
);
create index if not exists idx_permit_custody_events_job on public.permit_custody_events (org_id, job_id, created_at desc);

alter table public.job_scan_tokens enable row level security;
alter table public.permit_custody enable row level security;
alter table public.permit_custody_events enable row level security;

create policy "org members read job_scan_tokens" on public.job_scan_tokens
  for select using (is_org_member(org_id));
create policy "org members read permit_custody" on public.permit_custody
  for select using (is_org_member(org_id));
create policy "org members read permit_custody_events" on public.permit_custody_events
  for select using (is_org_member(org_id));

-- Writes go through server actions using the service-role admin client
-- (same pattern as the rest of the install feature set), so no insert/
-- update policy is needed for the anon/authenticated roles here.
