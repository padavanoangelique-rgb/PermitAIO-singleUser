-- Permit correction lessons — what a city asked, what cleared it, optional letter.
-- He searches these by city and job so the next submittal can learn.

create table if not exists public.permit_correction_lessons (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete set null,
  job_number text,
  jurisdiction text,
  trade text,
  asked text not null,
  cleared text,
  file_name text,
  storage_path text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_correction_lessons_org_city
  on public.permit_correction_lessons (org_id, jurisdiction);
create index if not exists idx_correction_lessons_org_job
  on public.permit_correction_lessons (org_id, job_id);

alter table public.permit_correction_lessons enable row level security;

drop policy if exists "members read correction lessons" on public.permit_correction_lessons;
create policy "members read correction lessons" on public.permit_correction_lessons
  for select using (is_org_member(org_id));

drop policy if exists "members write correction lessons" on public.permit_correction_lessons;
create policy "members write correction lessons" on public.permit_correction_lessons
  for all using (is_org_member(org_id)) with check (is_org_member(org_id));
