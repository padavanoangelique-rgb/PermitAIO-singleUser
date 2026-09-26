-- Platform-level admin flag for the owner/admin console. Separate from
-- per-org roles (owner/admin/manager/member) — this identifies the
-- PermitAIO founder/operator, who can see across ALL tenant orgs.
--
-- RLS only allows a user to check their OWN row (auth.uid() = user_id), so
-- the isPlatformAdmin() check can run with the regular authenticated
-- client. The admin console's actual cross-org data queries still require
-- the service-role client (src/lib/supabase/admin.ts) since they need to
-- read every organization regardless of membership.

create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.platform_admins enable row level security;

drop policy if exists "platform_admins_self_select" on public.platform_admins;
create policy "platform_admins_self_select"
  on public.platform_admins
  for select
  using (auth.uid() = user_id);

-- Seed the founder's own account as the first platform admin.
insert into public.platform_admins (user_id)
select id from auth.users where email = 'padavano.angelique@gmail.com'
on conflict (user_id) do nothing;
