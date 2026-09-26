-- Allow three additional permit statuses on jobs.sub_status.
alter table public.jobs drop constraint if exists jobs_sub_status_check;
alter table public.jobs
  add constraint jobs_sub_status_check
  check (sub_status in (
    'Need to Submit',
    'Quote Needed',
    'Engineering Pending',
    'In Review',
    'Corrections Needed',
    'Approved',
    'Approved and Printed',
    'Complete'
  ));
