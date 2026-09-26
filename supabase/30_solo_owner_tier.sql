-- Documents the new "solo" account type on organizations.subscription_tier
-- (added in src/lib/marketing/pricing.ts as soloOwnerTier). No ALTER TABLE
-- needed — the column is already unconstrained text (see
-- 11_billing_columns.sql) — this only updates its documentary comment.

comment on column organizations.subscription_tier is 'One of: essential, priority, concierge, solo. See src/lib/marketing/pricing.ts. "solo" is a single-seat account type — enforced in src/lib/actions/invites.ts and src/lib/actions/join-org.ts, not by a DB constraint.';
