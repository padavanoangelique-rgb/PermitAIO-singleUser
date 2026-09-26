-- Emails sent from a job (e.g. an engineering request) and the replies that come back
-- to it. Summary only: each row keeps who/when/subject and a short snippet, never the
-- full message body. Reply attachments are filed in job_files (Documents tab).
--
-- Rows are written by the server (send route + Resend inbound webhook, service role),
-- so members only need read access.

create table if not exists job_emails (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  job_id uuid not null references jobs(id) on delete cascade,
  direction text not null check (direction in ('outbound', 'inbound')),
  from_addr text not null,
  to_addrs text not null default '',
  subject text not null default '',
  summary text not null default '',
  attachment_names text[] not null default '{}',
  provider_id text,
  message_id text,
  sent_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_job_emails_job on job_emails (job_id, created_at desc);
create index if not exists idx_job_emails_org on job_emails (org_id);
create unique index if not exists uq_job_emails_provider on job_emails (direction, provider_id) where provider_id is not null;

alter table job_emails enable row level security;
create policy "members can read job emails" on job_emails for select using (is_org_member(org_id));
