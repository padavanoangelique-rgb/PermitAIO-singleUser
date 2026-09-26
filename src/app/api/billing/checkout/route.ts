import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canManageOrg } from "@/lib/data/orgs";
import { getSubscriptionTier, getOnboardingTier, resolvePromoCoupon } from "@/lib/marketing/pricing";
import { stripe } from "@/lib/stripe";

/**
 * Creates a Stripe Checkout Session that combines a recurring subscription
 * price with a one-time onboarding price in a single `mode: "subscription"`
 * session (Stripe supports mixing one-time + recurring line items in
 * subscription mode — the one-time item bills once on the first invoice).
 */
export async function POST(request: NextRequest) {
  let body: {
    subscriptionTierId?: string;
    onboardingTierId?: string;
    billingInterval?: string;
    promoCode?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const subscriptionTier = getSubscriptionTier(body.subscriptionTierId ?? "");
  const onboardingTier = getOnboardingTier(body.onboardingTierId ?? "");
  const billingInterval = body.billingInterval === "annual" ? "annual" : "monthly";

  if (!subscriptionTier || !onboardingTier) {
    return NextResponse.json(
      { error: "Choose a valid subscription plan and onboarding option." },
      { status: 400 },
    );
  }

  let promo: { couponId: string; percentOff: number } | null = null;
  if (body.promoCode && body.promoCode.trim()) {
    promo = resolvePromoCoupon(body.promoCode);
    if (!promo) {
      return NextResponse.json({ error: "That promo code isn't valid." }, { status: 400 });
    }
  }

  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  // Resolve the caller's org membership + role directly (route handlers
  // can't rely on the cookie-based "active org" helper the same way pages
  // do, so look up every org this user manages and use the first one — in
  // practice each account manages exactly one org at this stage).
  const { data: memberships, error: membershipError } = await supabase
    .from("organization_members")
    .select("role, org_id, organizations(id, name, stripe_customer_id)")
    .eq("user_id", userData.user.id);

  if (membershipError || !memberships || memberships.length === 0) {
    return NextResponse.json({ error: "No organization found." }, { status: 404 });
  }

  const membership = memberships.find((m) => canManageOrg(m.role as "owner" | "admin" | "manager" | "member"));
  if (!membership || !membership.organizations) {
    return NextResponse.json(
      { error: "Only an owner or admin can manage billing for this organization." },
      { status: 403 },
    );
  }

  const org = membership.organizations as unknown as {
    id: string;
    name: string;
    stripe_customer_id: string | null;
  };

  const origin = new URL(request.url).origin;
  const client = stripe();

  let customerId = org.stripe_customer_id ?? undefined;
  if (!customerId) {
    const customer = await client.customers.create({
      email: userData.user.email ?? undefined,
      name: org.name,
      metadata: { org_id: org.id },
    });
    customerId = customer.id;
    await supabase
      .from("organizations")
      .update({ stripe_customer_id: customerId })
      .eq("id", org.id);
  }

  const subscriptionPriceId =
    billingInterval === "annual" ? subscriptionTier.annualPriceId : subscriptionTier.priceId;
  if (!subscriptionPriceId) {
    return NextResponse.json(
      { error: "Annual billing isn't available for this plan yet." },
      { status: 400 },
    );
  }

  const session = await client.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [
      { price: subscriptionPriceId, quantity: 1 },
      { price: onboardingTier.priceId, quantity: 1 },
    ],
    ...(promo ? { discounts: [{ coupon: promo.couponId }] } : {}),
    success_url: `${origin}/billing?checkout=success`,
    cancel_url: `${origin}/billing?checkout=cancelled`,
    metadata: {
      org_id: org.id,
      subscription_tier: subscriptionTier.id,
      onboarding_tier: onboardingTier.id,
      billing_interval: billingInterval,
      promo_code: promo ? body.promoCode!.trim().toLowerCase() : "",
    },
    subscription_data: {
      metadata: {
        org_id: org.id,
        subscription_tier: subscriptionTier.id,
        onboarding_tier: onboardingTier.id,
        billing_interval: billingInterval,
      },
    },
  });

  await supabase
    .from("organizations")
    .update({ stripe_checkout_session_id: session.id })
    .eq("id", org.id);

  if (!session.url) {
    return NextResponse.json(
      { error: "Stripe did not return a checkout URL." },
      { status: 502 },
    );
  }

  return NextResponse.json({ url: session.url });
}
