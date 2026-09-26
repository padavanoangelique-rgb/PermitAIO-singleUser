-- ============================================================================
-- 29_notifications.sql — per-tech notification feed.
--
-- Nothing like this existed before this migration: every agent action
-- (Data Agent writes, Permits Agent notes, etc.) was only ever visible by
-- opening that specific job's Activity tab. This table + the notify()
-- helper (src/lib/notifications/notify.ts) is the shared destination every
-- agent write path now reports to, surfaced by a per-tech bell in the app
-- header.
-- ============================================================================

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  job_id uuid references jobs(id) on delete cascade,
  permit_tech text,
  source text not null check (source in ('data_agent', 'permits_agent', 'bulk_agent', 'intake_agent', 'sheet_agent', 'email_agent')),
  message text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_org_tech_unread
  on notifications (org_id, permit_tech, read_at, created_at desc);
create index if not exists idx_notifications_job on notifications (job_id);

alter table notifications enable row level security;

-- Same visibility rule as job_activity: any org member can see their org's
-- notifications (filtering to "my tech's" rows happens in the query, not
-- RLS, since permit_tech is a free-text label on organization_members, not
-- a hard per-row owner).
create policy "members can read their org notifications" on notifications
  for select using (is_org_member(org_id));

-- The cron/service-role path inserts directly (bypasses RLS), but allow an
-- authenticated org member to insert too in case a future in-app action
-- needs to notify without going through the service-role client.
create policy "members can insert notifications for their org" on notifications
  for insert to authenticated with check (is_org_member(org_id));

-- Marking a notification read is the one update a regular member needs.
create policy "members can mark their org notifications read" on notifications
  for update using (is_org_member(org_id)) with check (is_org_member(org_id));
