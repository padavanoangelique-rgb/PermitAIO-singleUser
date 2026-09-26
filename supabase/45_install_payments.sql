-- Money tracking for the Install Manager's job detail view: deposit,
-- change order, signed contract, and final payment, all per job on the
-- existing install_job_assignments row (same flat-column pattern already
-- used there for inspection_status/pm_checked_at/permit_checked_out_at).
alter table install_job_assignments
  add column if not exists deposit_collected boolean not null default false,
  add column if not exists deposit_amount numeric,
  add column if not exists deposit_date date,
  add column if not exists change_order boolean not null default false,
  add column if not exists contract_signed boolean not null default false,
  add column if not exists final_payment_collected boolean not null default false,
  add column if not exists final_payment_amount numeric,
  add column if not exists final_payment_date date;
