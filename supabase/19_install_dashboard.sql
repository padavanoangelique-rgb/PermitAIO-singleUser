-- Install Dashboard by PermitAIO — optional add-on, toggled per organization.
-- Permit techs never see this product unless the org flag is on AND they have
-- an install_* role. Company admin (e.g. permit@guardwhatmatters.com) can hold
-- both permit and install access.

alter table organizations
  add column if not exists install_dashboard_enabled boolean not null default false,
  add column if not exists install_seat_managers integer not null default 4,
  add column if not exists install_seat_pms integer not null default 4,
  add column if not exists install_seat_installers integer not null default 8;

comment on column organizations.install_dashboard_enabled is 'When false, Install Dashboard is hidden for every user in this org.';
comment on column organizations.install_seat_managers is 'Max installation manager seats.';
comment on column organizations.install_seat_pms is 'Max project manager seats.';
comment on column organizations.install_seat_installers is 'Max installer seats.';
