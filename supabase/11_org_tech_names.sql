-- Per-org display names for the fixed tech slots.
--
-- The three legacy tools (Permit Inventory and HOA Tracker) each have a fixed
-- roster of three tech slots — "Permit Tech 1/2/3" and "Tech 1/2/3" (HOA). Job
-- rows store the slot value as-is (unchanged behavior), but users want to see
-- the real technician's name on filter chips, dashboards, and settings.
--
-- This table maps (org_id, kind, slot) → display_name. NULL/empty display_name
-- means "show the raw slot label". No data migration needed on existing rows.

create table if not exists org_tech_names (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  kind text not null check (kind in ('permit', 'hoa')),
  slot text not null,
  display_name text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  unique (org_id, kind, slot)
);

-- Constrain slots to the two tools' fixed rosters.
alter table org_tech_names drop constraint if exists org_tech_names_slot_check;
alter table org_tech_names add constraint org_tech_names_slot_check check (
  (kind = 'permit' and slot in ('Permit Tech 1', 'Permit Tech 2', 'Permit Tech 3'))
  or (kind = 'hoa' and slot in ('Tech 1', 'Tech 2', 'Tech 3'))
);

create index if not exists idx_org_tech_names_org on org_tech_names (org_id, kind);

-- RLS: only members of the org can read; only owners/admins can write.
alter table org_tech_names enable row level security;

drop policy if exists "org members can read tech names" on org_tech_names;
create policy "org members can read tech names" on org_tech_names
  for select using (
    exists (
      select 1 from organization_members m
      where m.org_id = org_tech_names.org_id and m.user_id = auth.uid()
    )
  );

drop policy if exists "org admins can upsert tech names" on org_tech_names;
create policy "org admins can upsert tech names" on org_tech_names
  for insert with check (
    exists (
      select 1 from organization_members m
      where m.org_id = org_tech_names.org_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
    )
  );

drop policy if exists "org admins can update tech names" on org_tech_names;
create policy "org admins can update tech names" on org_tech_names
  for update using (
    exists (
      select 1 from organization_members m
      where m.org_id = org_tech_names.org_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
    )
  );

drop policy if exists "org admins can delete tech names" on org_tech_names;
create policy "org admins can delete tech names" on org_tech_names
  for delete using (
    exists (
      select 1 from organization_members m
      where m.org_id = org_tech_names.org_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
    )
  );
