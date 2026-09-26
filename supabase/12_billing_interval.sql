-- Tracks whether an org's active subscription is billed monthly or
-- annually (set from Stripe Checkout metadata on checkout.session.completed).

alter table organizations
  add column if not exists billing_interval text;

comment on column organizations.billing_interval is 'One of: monthly, annual. Set from the Stripe Checkout session metadata when the subscription starts. See src/lib/marketing/pricing.ts.';
