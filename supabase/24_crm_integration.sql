-- ============================================================================
-- 24_crm_integration.sql — CRM connections (Dynamics 365 first; the schema
-- is provider-agnostic so other CRMs from the CRM Bridge Study — JobNimbus,
-- LeadPerfection, improveit 360, MarketSharp, Builder Prime — plug into the
-- same two tables later without a new migration).
--
-- One PermitAIO Entra app registration (multi-tenant) lets ANY organization
-- connect ITS OWN Dynamics 365 tenant — this table is what keeps every
-- org's connection and tokens completely separate (`unique (org_id,
-- provider)`, RLS scoped to org admins only).
-- ============================================================================

create table if not exists crm_connections (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  provider text not null default 'dynamics365' check (provider in ('dynamics365')),
  external_tenant_id text not null,
  environment_url text not null,
  refresh_token text not null,
  access_token text,
  access_token_expires_at timestamptz,
  connected_by uuid references auth.users(id),
  status text not null default 'active' check (status in ('active', 'disconnected', 'error')),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, provider)
);

create index if not exists idx_crm_connections_org on crm_connections (org_id);

drop trigger if exists trg_crm_connections_updated_at on crm_connections;
create trigger trg_crm_connections_updated_at before update on crm_connections
  for each row execute function set_updated_at();

alter table crm_connections enable row level security;
-- Connection credentials are sensitive — only owners/admins can see or
-- manage them, same sensitivity level as billing (see billing/checkout).
create policy "admins can read crm connections" on crm_connections
  for select using (is_org_admin(org_id));
create policy "admins can write crm connections" on crm_connections
  for all using (is_org_admin(org_id)) with check (is_org_admin(org_id));

-- ---------------------------------------------------------------------------
-- Sync event log — one row per push/pull attempt, for audit + debugging a
-- failed sync from the UI without needing server log access.
-- ---------------------------------------------------------------------------

create table if not exists crm_sync_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  connection_id uuid not null references crm_connections(id) on delete cascade,
  job_id uuid references jobs(id) on delete set null,
  direction text not null check (direction in ('push', 'pull')),
  entity_type text not null,
  external_id text,
  status text not null default 'pending' check (status in ('pending', 'success', 'error')),
  error_message text,
  payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_crm_sync_events_org on crm_sync_events (org_id);
create index if not exists idx_crm_sync_events_job on crm_sync_events (job_id);
create index if not exists idx_crm_sync_events_connection on crm_sync_events (connection_id);

alter table crm_sync_events enable row level security;
create policy "admins can read crm sync events" on crm_sync_events
  for select using (is_org_admin(org_id));
create policy "members can log crm sync events" on crm_sync_events
  for insert to authenticated with check (is_org_member(org_id));

-- ---------------------------------------------------------------------------
-- Link a Job # to its external CRM record, so re-syncing the same job
-- updates the same Dynamics 365 Opportunity instead of creating a duplicate.
-- ---------------------------------------------------------------------------

alter table jobs add column if not exists external_source text;
alter table jobs add column if not exists external_customer_id text;
alter table jobs add column if not exists external_job_id text;
alter table jobs add column if not exists external_job_url text;
alter table jobs add column if not exists external_status text;
alter table jobs add column if not exists last_synced_at timestamptz;
alter table jobs add column if not exists sync_status text not null default 'not_synced'
  check (sync_status in ('not_synced', 'synced', 'error'));

create index if not exists idx_jobs_external_job_id on jobs (org_id, external_job_id);
