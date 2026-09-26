-- Private homeowner tracking links. One token per job.
-- Public /track/[token] reads via service role. Sales copies or emails the URL.
-- Does not write jobs.stage or jobs.sub_status.

create table if not exists public.homeowner_links (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  token text not null unique,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  last_viewed_at timestamptz,
  view_count integer not null default 0,
  unique (org_id, job_id)
);

create index if not exists homeowner_links_token_idx on public.homeowner_links (token);
create index if not exists homeowner_links_org_idx on public.homeowner_links (org_id);

alter table public.homeowner_links enable row level security;

drop policy if exists homeowner_links_org on public.homeowner_links;
create policy homeowner_links_org on public.homeowner_links
  for all using (
    org_id in (select org_id from public.organization_members where user_id = auth.uid())
  ) with check (
    org_id in (select org_id from public.organization_members where user_id = auth.uid())
  );
