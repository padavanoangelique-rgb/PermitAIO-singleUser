-- Starting brain from Investigator + Permit Form Specialist.
-- Manager consults these reports. He does not invent past them.

create table if not exists public.research_reports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  agent text not null check (agent in ('investigator', 'forms_specialist')),
  county text,
  jurisdiction text,
  title text not null,
  body text not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_research_reports_org on public.research_reports (org_id, agent);
create index if not exists idx_research_reports_city on public.research_reports (org_id, jurisdiction);

alter table public.research_reports enable row level security;

drop policy if exists "members read research reports" on public.research_reports;
create policy "members read research reports" on public.research_reports
  for select using (is_org_member(org_id));

drop policy if exists "members write research reports" on public.research_reports;
create policy "members write research reports" on public.research_reports
  for all using (is_org_member(org_id)) with check (is_org_member(org_id));
