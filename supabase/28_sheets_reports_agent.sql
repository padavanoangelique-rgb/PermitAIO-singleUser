-- ============================================================================
-- 28_sheets_reports_agent.sql — Reports Agent: read-only Google Sheets
-- onboarding tool. A platform admin connects a contractor's own spreadsheet
-- (read-only, spreadsheets.readonly scope only — this repo never writes
-- back to a customer's sheet), confirms once how its columns map to `jobs`
-- fields, and PermitAIO keeps those jobs updated automatically (manual
-- trigger + 3x/day cron) — the sheet-side equivalent of the bulk-update
-- email agent, replicable per company the same way the CRM integration is.
--
-- Four tables, not a reuse of crm_connections/crm_sync_events: a Sheets
-- connection needs spreadsheet_id + tab_name + a versioned column-mapping
-- (crm_connections has no room for that), and — unlike CRM's one-connection-
-- per-org-per-provider constraint — a single org routinely needs MULTIPLE
-- simultaneous sheet connections (e.g. Guardian's own "Windows and Roofing
-- Permits" + "Permit Assignment Source"), so a separate OAuth-grant layer
-- (one Google account) sits under multiple per-sheet connection rows.
-- ============================================================================

create or replace function is_platform_admin()
returns boolean language sql security definer stable as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid());
$$;

create table if not exists public.sheet_oauth_grants (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  google_email text not null,
  scope text not null,
  access_token_encrypted text not null,
  refresh_token_encrypted text not null,
  access_token_expires_at timestamptz not null,
  status text not null default 'connected' check (status in ('connected','revoked','error')),
  last_error text,
  granted_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, google_email)
);

create table if not exists public.sheet_connections (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  grant_id uuid not null references sheet_oauth_grants(id) on delete cascade,
  display_name text not null,
  spreadsheet_id text not null,
  spreadsheet_name text,
  tab_name text not null,
  tab_sheet_id int,
  priority int not null default 100,
  status text not null default 'active' check (status in ('active','paused','error')),
  last_error text,
  last_synced_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, spreadsheet_id, tab_name)
);

-- mappings shape: [{ column_index: int, column_header: text, target_field: text, is_match_key: boolean }]
create table if not exists public.sheet_mapping_versions (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references sheet_connections(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  version int not null,
  header_row int not null default 1,
  mappings jsonb not null,
  is_current boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (connection_id, version)
);

create unique index if not exists idx_one_current_mapping
  on sheet_mapping_versions (connection_id) where (is_current);

create table if not exists public.sheet_sync_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  connection_id uuid not null references sheet_connections(id) on delete cascade,
  mapping_version_id uuid references sheet_mapping_versions(id),
  trigger text not null check (trigger in ('manual','cron')),
  triggered_by uuid references auth.users(id),
  status text not null default 'running' check (status in ('running','success','partial_error','error')),
  rows_read int not null default 0,
  rows_matched int not null default 0,
  rows_updated int not null default 0,
  rows_skipped int not null default 0,
  rows_errored int not null default 0,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists idx_sheet_connections_org on sheet_connections (org_id);
create index if not exists idx_sheet_oauth_grants_org on sheet_oauth_grants (org_id);
create index if not exists idx_sheet_mapping_versions_connection on sheet_mapping_versions (connection_id);
create index if not exists idx_sheet_sync_runs_connection on sheet_sync_runs (connection_id, started_at desc);

drop trigger if exists trg_sheet_oauth_grants_updated_at on sheet_oauth_grants;
create trigger trg_sheet_oauth_grants_updated_at before update on sheet_oauth_grants
  for each row execute function set_updated_at();

drop trigger if exists trg_sheet_connections_updated_at on sheet_connections;
create trigger trg_sheet_connections_updated_at before update on sheet_connections
  for each row execute function set_updated_at();

alter table sheet_oauth_grants enable row level security;
alter table sheet_connections enable row level security;
alter table sheet_mapping_versions enable row level security;
alter table sheet_sync_runs enable row level security;

-- Platform admin: full control. Service-role client (used by every route
-- and the cron) bypasses RLS regardless — these policies keep the tables
-- honest if ever queried from a session-bound client.
create policy "platform admin manages oauth grants" on sheet_oauth_grants
  for all using (is_platform_admin()) with check (is_platform_admin());
create policy "platform admin manages sheet connections" on sheet_connections
  for all using (is_platform_admin()) with check (is_platform_admin());
create policy "platform admin manages mapping versions" on sheet_mapping_versions
  for all using (is_platform_admin()) with check (is_platform_admin());
create policy "platform admin manages sync runs" on sheet_sync_runs
  for all using (is_platform_admin()) with check (is_platform_admin());

-- Org admins get read-only visibility into their own org's sheet activity —
-- transparency, not control (they can't connect/edit/disconnect).
create policy "org admins read their sheet connections" on sheet_connections
  for select using (is_org_admin(org_id));
create policy "org admins read their sync runs" on sheet_sync_runs
  for select using (is_org_admin(org_id));
