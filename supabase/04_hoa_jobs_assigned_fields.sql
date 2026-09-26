-- Adds the "assigned to" / "assigned date" fields to hoa_jobs.
--
-- These two fields are part of the original HOA Tracker's live functionality
-- (job assignment to Tech 1/2/3, assigned-date stamping, tech filter tabs,
-- and both print reports) but were missing from the schema.sql this project
-- was ported from -- that file only reflected the original table definition,
-- not later ad hoc columns added directly in Supabase. Adding them here
-- keeps HOA Tracker's functionality exactly as it behaves in production.

alter table hoa_jobs add column if not exists assigned_to text default '';
alter table hoa_jobs add column if not exists assigned_date date;
create index if not exists idx_hoa_jobs_assigned_to on hoa_jobs (assigned_to);
