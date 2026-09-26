// Each tier has both a TEST MODE and a LIVE MODE Stripe price id. Whichever
// one is used at runtime is picked automatically based on whether
// STRIPE_SECRET_KEY (set per Vercel environment) is a live or test key, so
// local dev / preview can keep using test keys while production runs live
// without any code changes.
const IS_LIVE = process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_") ?? false;

const PRICE_IDS = {
  essential: { test: "price_1U7lQoRs16zJo195yk3oYT9q", live: "price_1U7o60Rs16zJo195HRZPHk9F" },
  priority: { test: "price_1U7lQoRs16zJo195p64DDght", live: "price_1U7o60Rs16zJo195JBwfss5R" },
  concierge: { test: "price_1U7lQoRs16zJo195zp4ol1AX", live: "price_1U7o61Rs16zJo195nKLKNDX5" },
  self_serve: { test: "price_1U7lQoRs16zJo195RkJ9bZlE", live: "price_1U7o61Rs16zJo1953LkvVhB1" },
  standard: { test: "price_1U7lQoRs16zJo195qaPGZ87s", live: "price_1U7o61Rs16zJo195nJiWVyfY" },
  white_glove: { test: "price_1U7lQpRs16zJo195u8UQ1LIH", live: "price_1U7o62Rs16zJo1959zrVbyos" },
  // No self-serve checkout for Solo Owner — payment is collected via a
  // manually-sent Stripe Payment Link, not this app's Checkout flow. Fill
  // these in only if that changes.
  solo: { test: "", live: "" },
} as const;

// Annual variants of the three monthly subscription tiers — 17% off the
// monthly-equivalent annual total (empirically the market-standard SaaS
// annual discount; see Vendr 2024 data). Live-mode ids are placeholders
// until the equivalent live Prices are created in Stripe (same pattern as
// PRICE_IDS above — the live key is needed once to create them).
const ANNUAL_PRICE_IDS = {
  essential: { test: "price_1U7oWwRs16zJo195QqKr0VA9", live: "" },
  priority: { test: "price_1U7oWxRs16zJo1952knueCIC", live: "" },
  concierge: { test: "price_1U7oWxRs16zJo195cZPztWKv", live: "" },
} as const;

// Server-validated "typed promo code" (revealed behind a "Have a promo
// code?" link rather than an always-visible field — converts better per
// the token-effort-effect research). Maps a code the customer types to a
// real Stripe Coupon id, applied via `discounts: [{ coupon }]` on the
// Checkout Session rather than Stripe's built-in `allow_promotion_codes`
// box, so we control the reveal-on-click UX ourselves.
const PROMO_CODES = {
  welcome15: {
    coupon: { test: "WELCOME15", live: "" },
    percentOff: 15,
    description: "15% off your first invoice",
  },
  // Comps only the one-time onboarding/setup fee (restricted to the
  // onboarding Products in Stripe via applies_to) — the monthly
  // subscription still bills normally.
  setupfree: {
    coupon: { test: "SETUPFREE", live: "" },
    percentOff: 100,
    description: "Setup fee waived",
  },
  // Full comp — 100% off both the setup fee and the subscription, every
  // month, for as long as the code stays applied. Intended for friends,
  // family, and hand-picked trial users rather than general promotion.
  allfree: {
    coupon: { test: "ALLFREE", live: "" },
    percentOff: 100,
    description: "Setup fee and subscription both waived",
  },
  halfoff50: {
    coupon: { test: "HALFOFF50", live: "" },
    percentOff: 50,
    description: "50% off the setup fee and subscription, every month",
  },
} as const satisfies Record<string, { coupon: { test: string; live: string }; percentOff: number; description: string }>;

function resolvePriceId(id: keyof typeof PRICE_IDS): string {
  return IS_LIVE ? PRICE_IDS[id].live : PRICE_IDS[id].test;
}

export function resolveAnnualPriceId(id: keyof typeof ANNUAL_PRICE_IDS): string {
  return IS_LIVE ? ANNUAL_PRICE_IDS[id].live : ANNUAL_PRICE_IDS[id].test;
}

/** Looks up a typed promo code (case-insensitive) and returns the Stripe
 * Coupon id to apply, or null if the code doesn't exist. */
export function resolvePromoCoupon(code: string): { couponId: string; percentOff: number } | null {
  const key = code.trim().toLowerCase();
  const entry = (PROMO_CODES as Record<string, { coupon: { test: string; live: string }; percentOff: number }>)[key];
  if (!entry) return null;
  const couponId = IS_LIVE ? entry.coupon.live : entry.coupon.test;
  if (!couponId) return null;
  return { couponId, percentOff: entry.percentOff };
}

export type OnboardingTier = {
  id: "self_serve" | "standard" | "white_glove";
  name: string;
  price: number;
  priceLabel: string;
  priceId: string;
  description: string;
  features: string[];
  recommended?: boolean;
};

export const onboardingTiers: OnboardingTier[] = [
  {
    id: "self_serve",
    name: "Self-Serve",
    price: 499,
    priceLabel: "$499",
    priceId: resolvePriceId("self_serve"),
    description:
      "Get your files loaded in and learn PermitAIO on your own schedule — no call, no in-person visit.",
    features: [
      "We upload your first pulled report to get your account started",
      "Step-by-step recorded video tutorials on the website",
      "You pull future reports from your own CRM going forward",
    ],
  },
  {
    id: "standard",
    name: "Standard",
    price: 999,
    priceLabel: "$999",
    priceId: resolvePriceId("standard"),
    description:
      "Everything in Self-Serve, plus a live walkthrough with our team.",
    features: [
      "Everything in Self-Serve",
      "Your files loaded in for you",
      "1-hour phone tutorial with your team",
    ],
    recommended: true,
  },
  {
    id: "white_glove",
    name: "White-Glove",
    price: 1999,
    priceLabel: "$1,999",
    priceId: resolvePriceId("white_glove"),
    description:
      "A full hands-on setup — we audit your process and get you live in person.",
    features: [
      "A full audit of your current permitting process",
      "We pull your existing data and upload it into PermitAIO for you",
      "In-person tutorial for your team",
    ],
  },
];

export type SubscriptionTier = {
  id: "essential" | "priority" | "concierge" | "solo";
  name: string;
  price: number;
  priceLabel: string;
  priceId: string;
  /** Annual billing — 17% off the monthly-equivalent total, billed once a year. */
  annualPrice: number;
  annualPriceLabel: string;
  annualMonthlyEquivalentLabel: string;
  annualPriceId: string;
  cadence: string;
  description: string;
  /** One-time onboarding fee bundled with the plan (not a separate choice). */
  onboardingPrice: number;
  onboardingPriceLabel: string;
  /** Short tag rendered above the features list under "Onboarding included". */
  onboardingSummary: string[];
  cta: string;
  ctaHref: string;
  highlighted?: boolean;
  features: string[];
};

const ANNUAL_DISCOUNT = 0.17;

function annualPricing(monthlyPrice: number) {
  const annualPrice = Math.round(monthlyPrice * 12 * (1 - ANNUAL_DISCOUNT) * 100) / 100;
  const monthlyEquivalent = Math.round((annualPrice / 12) * 100) / 100;
  return {
    annualPrice,
    annualPriceLabel: `$${annualPrice.toLocaleString("en-US")}`,
    annualMonthlyEquivalentLabel: `$${monthlyEquivalent.toLocaleString("en-US")}/mo billed annually`,
  };
}

export const subscriptionTiers: SubscriptionTier[] = [
  {
    id: "essential",
    name: "Essential",
    price: 379,
    priceLabel: "$379",
    priceId: resolvePriceId("essential"),
    ...annualPricing(379),
    annualPriceId: resolveAnnualPriceId("essential"),
    cadence: "/month",
    description: "Small office. You run the software.",
    onboardingPrice: 1500,
    onboardingPriceLabel: "$1,500 one-time onboarding",
    onboardingSummary: [
      "One CRM pull",
      "We load up to 50 jobs and 25 HOAs",
      "Recorded tutorials",
      "No live call",
    ],
    cta: "Contact us",
    ctaHref: "#contact",
    features: [
      "3 users",
      "Unlimited permit packages",
      "Full builder: floor plan (auto-calculates), schedule, NOAs, forms, checklist → one zip",
      "Permit inventory and HOA tracker",
      "Broward, Miami-Dade, and Palm Beach jurisdiction detection",
      "Forms and NOA library updated weekly",
      "Manager and tech roles",
      "Reports",
      "Software support only (how the product works — not job advice)",
    ],
  },
  {
    id: "priority",
    name: "Priority",
    price: 629,
    priceLabel: "$629",
    priceId: resolvePriceId("priority"),
    ...annualPricing(629),
    annualPriceId: resolveAnnualPriceId("priority"),
    cadence: "/month",
    description: "The shop plan. Same product, more seats, a larger first load.",
    onboardingPrice: 2900,
    onboardingPriceLabel: "$2,900 one-time onboarding",
    onboardingSummary: [
      "CRM pull",
      "We load up to 200 jobs and 100 HOAs",
      "One 60-minute remote walkthrough",
      "File cleaned enough to import — we do not rebuild your CRM",
    ],
    cta: "Contact us",
    ctaHref: "#contact",
    highlighted: true,
    features: [
      "Everything in Essential",
      "8 users",
      "Unlimited packages",
    ],
  },
  {
    id: "concierge",
    name: "Concierge",
    price: 879,
    priceLabel: "$879",
    priceId: resolvePriceId("concierge"),
    ...annualPricing(879),
    annualPriceId: resolveAnnualPriceId("concierge"),
    cadence: "/month",
    description: "Highest volume team. Biggest first load. Still not us running your desk.",
    onboardingPrice: 4400,
    onboardingPriceLabel: "$4,400 one-time onboarding",
    onboardingSummary: [
      "CRM pull",
      "We load up to 500 jobs and 250 HOAs",
      "One remote process session for your team",
      "Training is remote",
      "In-person visit (South Florida, up to 2 hours) is +$1,000 on request",
    ],
    cta: "Contact us",
    ctaHref: "#contact",
    features: [
      "Everything in Priority",
      "15 users",
      "Unlimited packages",
    ],
  },
];

/** Solo Owner — a single-seat account type for a one-person shop. Kept out
 * of `subscriptionTiers` (and therefore out of /billing's self-serve Stripe
 * Checkout flow) since this tier is never self-serve: onboarding is
 * handled directly, and payment is collected via a manually-sent Stripe
 * Payment Link. Rendered on /pricing by its own card, and set on an org
 * from the admin Trials & Billing table. */
export const soloOwnerTier: SubscriptionTier = {
  id: "solo",
  name: "Solo Owner",
  price: 199,
  priceLabel: "$199",
  priceId: resolvePriceId("solo"),
  ...annualPricing(199),
  annualPriceId: "",
  cadence: "/month",
  description: "Just you — every feature, one seat.",
  onboardingPrice: 500,
  onboardingPriceLabel: "$500 one-time setup",
  onboardingSummary: [
    "One CRM pull",
    "We load your existing jobs and HOAs",
    "Recorded tutorials",
    "No live call",
  ],
  cta: "Contact us",
  ctaHref: "#contact",
  features: [
    "1 user — you",
    "Computer and app access, start to finish, same as every other plan",
    "Unlimited permit packages",
    "Full builder: floor plan (auto-calculates), schedule, NOAs, forms, checklist → one zip",
    "Permit inventory and HOA tracker",
    "Broward, Miami-Dade, and Palm Beach jurisdiction detection",
    "Forms and NOA library updated weekly",
    "Reports",
    "Software support only (how the product works — not job advice)",
  ],
};

/** The one account-type id that's capped at a single seat today. Future
 * restricted account types (more are coming) should extend this check —
 * and only this check — rather than adding new conditionals at each call
 * site that needs to know whether an org can add a second person. */
export const SOLO_TIER_ID = "solo" as const;

export function isSoloAccountTier(tier: string | null | undefined): boolean {
  return tier === SOLO_TIER_ID;
}

export function getSubscriptionTier(id: string) {
  if (id === SOLO_TIER_ID) return soloOwnerTier;
  return subscriptionTiers.find((t) => t.id === id);
}

export function getOnboardingTier(id: string) {
  return onboardingTiers.find((t) => t.id === id);
}

export const TRIAL_DAYS = 14;

export type ComparisonRow = {
  label: string;
  values: [string, string, string];
};

export const comparisonRows: ComparisonRow[] = [
  { label: "Monthly price", values: ["$379", "$629", "$879"] },
  {
    label: "One-time onboarding",
    values: ["$1,500", "$2,900", "$4,400"],
  },
  { label: "Users included", values: ["3", "8", "15"] },
  {
    label: "Extra user",
    values: ["$39/mo", "$39/mo", "$39/mo"],
  },
  {
    label: "Permit packages",
    values: ["Unlimited", "Unlimited", "Unlimited"],
  },
  {
    label: "Jobs loaded at onboarding",
    values: ["Up to 50", "Up to 200", "Up to 500"],
  },
  {
    label: "HOAs loaded at onboarding",
    values: ["Up to 25", "Up to 100", "Up to 250"],
  },
  {
    label: "Extra data after cap",
    values: [
      "$249 per +100 jobs / +50 HOAs",
      "$249 per +100 jobs / +50 HOAs",
      "$249 per +100 jobs / +50 HOAs",
    ],
  },
  {
    label: "Onboarding walkthrough",
    values: [
      "Recorded tutorials — no live call",
      "60-minute remote walkthrough",
      "Remote process session for your team",
    ],
  },
  {
    label: "In-person visit (South Florida)",
    values: ["—", "—", "+$1,000 on request"],
  },
  {
    label: "Counties",
    values: [
      "Broward, Miami-Dade, Palm Beach",
      "Broward, Miami-Dade, Palm Beach",
      "Broward, Miami-Dade, Palm Beach",
    ],
  },
  {
    label: "Forms & NOA library updates",
    values: ["Weekly", "Weekly", "Weekly"],
  },
  {
    label: "Support",
    values: [
      "Software support only",
      "Software support only",
      "Software support only",
    ],
  },
];

// ─── Add-ons ────────────────────────────────────────────────────────────────
// Optional extras that attach to any monthly plan. Priced separately
// from the tiers themselves.

export type AddOnLinkTier = {
  name: string;
  limit: string;
  priceLabel: string;
};

export const emailAssistantAddOn = {
  name: "Permit Email Assistant",
  priceLabel: "$199/month",
  description: "Can be added to Essential, Priority, or Concierge.",
  features: [
    "Daily: every permit that moved — issued, in review, waiting on HOA, inspection set, stalled — plus the next step on each",
    "Weekly: full inventory rollup so the owner can see the board without opening the app",
  ],
  disclaimer:
    "This is an automated report. It does not mean we touch the job.",
} as const;

export const homeownerLinkTiers: AddOnLinkTier[] = [
  { name: "Basic", limit: "Up to 50 open links", priceLabel: "$49/month" },
  { name: "Shop", limit: "Up to 200 open links", priceLabel: "$99/month" },
  { name: "Unlimited", limit: "Unlimited open links", priceLabel: "$179/month" },
];

export const homeownerLinkDescription =
  "Friendly status page the homeowner can open. No internal notes. No county jargon. Add to any monthly plan.";

export const notIncludedList: string[] = [
  "Us fixing a stuck permit",
  "Calling the city",
  "Unlimited data imports",
  "Unlimited onboarding calls",
];

export const notIncludedFootnote =
  "Email review of a single job (we look, we tell you the next step, we do not solve it) is sold separately as tokens if we offer them later.";

export const extrasSummary = {
  extraUser: "Extra user on any plan: $39/month",
  extraData: "Extra data after the plan cap: $249 per +100 jobs or +50 HOAs",
  annual: "Annual: pay 10 months, get 12.",
} as const;
