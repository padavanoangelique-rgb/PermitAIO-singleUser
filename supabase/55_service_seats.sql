-- Platform-admin seat counts for Service, same pattern as Install Dashboard.

alter table public.organizations
  add column if not exists service_dashboard_enabled boolean not null default true,
  add column if not exists service_seat_managers integer not null default 2,
  add column if not exists service_seat_techs integer not null default 8;

comment on column public.organizations.service_dashboard_enabled is 'When false, Service Dashboard is hidden for this org.';
comment on column public.organizations.service_seat_managers is 'Max service manager seats.';
comment on column public.organizations.service_seat_techs is 'Max service tech seats.';
