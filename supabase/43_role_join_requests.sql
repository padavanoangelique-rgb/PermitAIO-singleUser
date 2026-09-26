-- Self-serve QR join for Permit Tech / HOA Tech / Manager roles.
-- Scanning the QR (Settings -> "Scan to join the team") signs someone in
-- as a base org member immediately (no pre-created invite needed) and
-- records which role they're claiming here. An owner/admin/manager then
-- confirms it in Settings -> Pending join requests.

create table if not exists role_join_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  requested_role text not null check (requested_role in ('permit_tech', 'hoa_tech', 'manager')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied')),
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references auth.users(id),
  unique (org_id, user_id, requested_role)
);

create index if not exists idx_role_join_requests_org on role_join_requests (org_id);

alter table role_join_requests enable row level security;

create policy "org members can view role join requests"
  on role_join_requests for select
  using (is_org_member(org_id));
