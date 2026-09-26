-- Per-company seat counts for the app's core roles, set by the platform
-- admin as part of onboarding — same pattern as install_seat_managers /
-- install_seat_pms / install_seat_installers in 19_install_dashboard.sql,
-- just for the core roles instead of the Install Dashboard add-on.
--
-- Permit tech and HOA tech default to 3 because that's today's fixed
-- roster size (see 11_org_tech_names.sql) — this column doesn't change
-- that roster, it's the number the admin agreed to with the customer.

alter table organizations
add column if not exists permit_tech_seats integer not null default 3,
add column if not exists hoa_tech_seats integer not null default 3,
add column if not exists admin_seats integer not null default 1,
add column if not exists manager_seats integer not null default 2,
add column if not exists member_seats integer not null default 5;

comment on column organizations.permit_tech_seats is 'How many permit tech positions this company is onboarded for. Set by the platform admin, not enforced elsewhere yet.';
comment on column organizations.hoa_tech_seats is 'How many HOA tech positions this company is onboarded for. Set by the platform admin, not enforced elsewhere yet.';
comment on column organizations.admin_seats is 'How many admin-role logins this company is onboarded for. Set by the platform admin, not enforced elsewhere yet.';
comment on column organizations.manager_seats is 'How many manager-role logins this company is onboarded for. Set by the platform admin, not enforced elsewhere yet.';
comment on column organizations.member_seats is 'How many member-role logins this company is onboarded for. Set by the platform admin, not enforced elsewhere yet.';
