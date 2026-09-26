-- Accounting role: can open the Accounting ledger (receipts) without
-- becoming an org admin. Owners and admins keep access too.

alter table organization_members
  drop constraint if exists organization_members_role_check;

alter table organization_members
  add constraint organization_members_role_check
  check (role in ('owner', 'admin', 'manager', 'member', 'accounting'));

alter table organization_invites
  drop constraint if exists organization_invites_role_check;

alter table organization_invites
  add constraint organization_invites_role_check
  check (role in ('admin', 'manager', 'member', 'accounting'));
