alter table role_join_requests drop constraint if exists role_join_requests_requested_role_check;

alter table role_join_requests add constraint role_join_requests_requested_role_check
  check (requested_role in ('permit_tech', 'hoa_tech', 'manager', 'account_manager', 'project_manager', 'installer'));
