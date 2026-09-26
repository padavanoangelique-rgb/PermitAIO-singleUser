-- Invited (but not-yet-member) users need to read basic info about the org
-- they were invited to, so the invite banner can show the real org name and
-- so accepting an invite can look up the org's slug to switch the active
-- workspace. The existing "members can read their org" policy blocks this
-- because the invited person isn't a member yet — that's the whole point of
-- an invite. This adds a narrow, email-scoped read policy alongside it.
create policy "invited users can read orgs they have a pending invite to"
on public.organizations
for select
using (
  exists (
    select 1
    from public.organization_invites oi
    where oi.org_id = organizations.id
      and lower(oi.email) = lower((select email from public.profiles where id = auth.uid()))
      and oi.accepted_at is null
      and oi.revoked_at is null
      and oi.expires_at > now()
  )
);
