-- Adds trial/subscription/Stripe billing state to organizations.
-- (Documented retroactively — these columns were applied directly to the
-- PermitAIO-v2 Supabase project during the pricing/billing restructure;
-- this file lets a fresh project reach the same schema.)

alter table organizations
  add column if not exists trial_ends_at timestamptz not null default (now() + interval '14 days'),
  add column if not exists subscription_status text not null default 'trialing',
  add column if not exists subscription_tier text,
  add column if not exists onboarding_tier text,
  add column if not exists onboarding_paid boolean not null default false,
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_checkout_session_id text;

comment on column organizations.trial_ends_at is '14-day free trial deadline. Access is blocked (redirect to /billing) once this passes unless subscription_status is active or past_due.';
comment on column organizations.subscription_status is 'Mirrors Stripe subscription status: trialing, active, past_due, canceled, unpaid, incomplete_expired.';
comment on column organizations.subscription_tier is 'One of: essential, priority, concierge. See src/lib/marketing/pricing.ts.';
comment on column organizations.onboarding_tier is 'One of: self_serve, standard, white_glove. One-time fee, set once at checkout.';
