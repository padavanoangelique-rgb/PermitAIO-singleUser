-- HOA tech lives on the job so it can be assigned before the community is known.
-- "NO HOA" is a valid assignment for jobs that do not need an association.

alter table public.jobs
  add column if not exists hoa_tech text not null default '';

update public.jobs j
set hoa_tech = h.assigned_to
from public.hoa_jobs h
where h.job_id = j.id
  and coalesce(j.hoa_tech, '') = ''
  and coalesce(h.assigned_to, '') <> '';
