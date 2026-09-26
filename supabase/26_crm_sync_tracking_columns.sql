-- ============================================================================
-- 26_crm_sync_tracking_columns.sql — the four `jobs` columns the Dynamics 365
-- bidirectional sync cron (src/app/api/cron/dynamics365-sync/route.ts) has
-- referenced since it was written, but that migration 24 never actually
-- created. Confirmed by grepping the full repo for every `d365_*` reference
-- before writing this: exactly these four, only on `jobs`, nowhere else.
--
-- Without them, every insert/select the cron route makes against `jobs`
-- fails with Postgres "column does not exist" (42703) — the inbound
-- create-job path, the bidirectional status mirror, and the one-time
-- milestone-date pushes have never been able to run.
-- ============================================================================

-- Local PermitAIO-side mirror of the Dynamics 365 Opportunity's
-- new_jobstatus at the moment we last pushed our stage to it. Compared
-- against jobs.stage on every cron run to detect "PermitAIO changed since
-- we last pushed" without needing a separate outbox/event table. Null means
-- "never pushed yet" — the comparison `stage !== d365_pushed_stage` treats
-- that as a difference, so the very first post-link cron run pushes the
-- job's initial stage exactly once.
alter table jobs add column if not exists d365_pushed_stage text;

-- Timestamp of the last time this job's Dynamics 365 side was read
-- (pulled), independent of last_synced_at (which tracks the *manual*
-- one-off push button, a different code path with a different meaning).
-- Compared against the Opportunity's own modifiedon to decide which side
-- changed more recently. Null is treated as "older than anything" by the
-- existing `? ... : 0` fallback in the cron route, so a newly linked job's
-- first cron run always treats Dynamics 365 as unchanged-since-last-look
-- and defers to the push branch instead.
alter table jobs add column if not exists d365_last_pulled_at timestamptz;

-- One-time push guards for the milestone date fields (new_permitsubmitteddate
-- / new_permitapproveddate) — each date is pushed to Dynamics 365 exactly
-- once, the first cron run after the corresponding PermitAIO date is set.
-- Not nullable: a milestone is either pushed or it isn't, there's no
-- meaningful third state, so false is the correct default for both new and
-- existing rows rather than leaving room for an ambiguous null.
alter table jobs add column if not exists d365_submitted_pushed boolean not null default false;
alter table jobs add column if not exists d365_approved_pushed boolean not null default false;

-- No new indexes: all four columns are only ever read as part of a row
-- already selected by the existing `idx_jobs_external_job_id (org_id,
-- external_job_id)` index (see the cron route's `.eq("external_source",
-- "dynamics365").not("external_job_id", "is", null)` query) and compared
-- in application code afterward — none of them is ever used as a filter
-- predicate on its own, so an index here would add write overhead with no
-- read benefit.
--
-- Existing jobs are unaffected: `add column if not exists` with a constant
-- default (null or false) is a metadata-only change on Postgres — no table
-- rewrite, no lock beyond the brief one already required for any DDL. Every
-- job created before this migration simply reads as "never pushed / never
-- pulled," which is the correct, safe starting state — the next cron run
-- treats each of them exactly like a freshly linked job.
