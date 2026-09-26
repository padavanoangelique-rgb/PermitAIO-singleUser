-- One 4-digit join code per company. Guardian is 4660.
alter table public.organizations
  add column if not exists join_code text;

update public.organizations
set join_code = '4660'
where join_code is distinct from '4660'
  and (
    name ilike '%guardian%'
    or slug ilike '%guardian%'
    or name ilike '%guard what matters%'
  );

with numbered as (
  select id,
    lpad((1000 + (row_number() over (order by created_at))::int)::text, 4, '0') as next_code
  from public.organizations
  where join_code is null
    and not (
      name ilike '%guardian%'
      or slug ilike '%guardian%'
      or name ilike '%guard what matters%'
    )
)
update public.organizations o
set join_code = n.next_code
from numbered n
where o.id = n.id
  and n.next_code <> '4660';

create unique index if not exists organizations_join_code_uidx
  on public.organizations (join_code)
  where join_code is not null;
