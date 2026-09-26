-- Service tickets: tech writes the issue, attaches photos, manager prints daily/weekly.

create table if not exists public.service_tickets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  job_number text not null,
  service_tech_id uuid references public.service_members(id) on delete set null,
  issue text not null,
  photo_paths text[] not null default '{}',
  submitted_at timestamptz not null default now(),
  submitted_by uuid references auth.users(id) on delete set null
);

create index if not exists service_tickets_org_idx on public.service_tickets (org_id, submitted_at desc);
create index if not exists service_tickets_job_idx on public.service_tickets (job_id);

alter table public.service_tickets enable row level security;

drop policy if exists service_tickets_org_read on public.service_tickets;
create policy service_tickets_org_read on public.service_tickets
  for select using (
    org_id in (select org_id from public.organization_members where user_id = auth.uid())
  );

drop policy if exists service_tickets_org_write on public.service_tickets;
create policy service_tickets_org_write on public.service_tickets
  for all using (
    org_id in (select org_id from public.organization_members where user_id = auth.uid())
  ) with check (
    org_id in (select org_id from public.organization_members where user_id = auth.uid())
  );
