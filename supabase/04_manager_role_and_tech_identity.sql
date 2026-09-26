-- ============================================================================
-- PermitAIO — Manager role + per-user tech identity
-- ============================================================================
-- Purely additive on top of 03_fix_org_creation_rls.sql / schema.sql:
--  * Adds "manager" as a valid organization_members.role value, sitting
--    between admin and member: a manager can reassign which permit tech /
--    HOA tech is working a job and see a team-wide status breakdown, but
--    (unlike admin/owner) cannot manage org settings or the member roster.
--  * Adds two nullable, free-text columns to organization_members so each
--    login can self-identify which existing PERMIT_TECHS / HOA_TECHS preset
--    label they are ("Permit Tech 1", "Tech 2", etc). This does NOT touch
--    jobs.permit_tech or hoa_jobs.assigned_to — those keep their exact
--    existing data shape; the new columns just let the app match "my jobs"
--    against the current login.
--  * Only an organization owner may change a member's role (enforced by
--    trigger, not just the app) — admins can still manage the rest of a
--    member row (kept from the original policy) and every member can now
--    update their own row so they can self-select their tech identity.
-- ============================================================================

alter table organization_members
  drop constraint if exists organization_members_role_check;

alter table organization_members
  add constraint organization_members_role_check
  check (role in ('owner', 'admin', 'manager', 'member'));

alter table organization_members
  add column if not exists permit_tech_label text,
  add column if not exists hoa_tech_label text;

-- Let a member update their own row (needed for self-service tech identity)
-- without loosening anything else — role changes are still blocked below
-- unless the acting user is an owner.
drop policy if exists "members can update their own membership" on organization_members;
create policy "members can update their own membership" on organization_members
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function protect_member_role_change()
returns trigger language plpgsql security definer as $$
begin
  if new.role is distinct from old.role then
    if not exists (
      select 1 from organization_members
      where org_id = old.org_id and user_id = auth.uid() and role = 'owner'
    ) then
      raise exception 'Only an organization owner can change member roles';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_member_role on organization_members;
create trigger trg_protect_member_role before update on organization_members
  for each row execute function protect_member_role_change();
