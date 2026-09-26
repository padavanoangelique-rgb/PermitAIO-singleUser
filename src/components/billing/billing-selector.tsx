"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, Loader2, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  subscriptionTiers,
  onboardingTiers,
  type SubscriptionTier,
  type OnboardingTier,
} from "@/lib/marketing/pricing";

type BillingInterval = "monthly" | "annual";

function TierCard<T extends { id: string; name: string; description: string; features: string[] }>({
  tier,
  price,
  cadence,
  subCaption,
  selected,
  onSelect,
}: {
  tier: T;
  price: string;
  cadence?: string;
  subCaption?: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex flex-col rounded-xl border p-5 text-left transition-colors",
        selected
          ? "border-primary bg-primary/5 ring-1 ring-primary"
          : "border-border bg-card hover:border-primary/40",
      )}
    >
      <div className="flex items-center justify-between">
        <span className="font-heading text-base font-semibold">
          {tier.name}
        </span>
        {selected && <Check className="h-4 w-4 text-primary" />}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{tier.description}</p>
      <div className="mt-3 flex items-baseline gap-1">
        <span className="font-heading text-xl font-semibold">{price}</span>
        {cadence && (
          <span className="text-xs text-muted-foreground">{cadence}</span>
        )}
      </div>
      {subCaption && (
        <p className="mt-0.5 text-[11px] text-muted-foreground">{subCaption}</p>
      )}
      <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">
        {tier.features.map((f) => (
          <li key={f}>• {f}</li>
        ))}
      </ul>
    </button>
  );
}

export function BillingSelector({
  initialSubscriptionTier,
  initialOnboardingTier,
}: {
  initialSubscriptionTier: string | null;
  initialOnboardingTier: string | null;
}) {
  const [subscriptionTierId, setSubscriptionTierId] = useState<
    SubscriptionTier["id"] | null
  >((initialSubscriptionTier as SubscriptionTier["id"]) ?? "priority");
  const [onboardingTierId, setOnboardingTierId] = useState<
    OnboardingTier["id"] | null
  >((initialOnboardingTier as OnboardingTier["id"]) ?? null);
  const [billingInterval, setBillingInterval] = useState<BillingInterval>("monthly");
  const [showPromoField, setShowPromoField] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCheckout() {
    if (!subscriptionTierId || !onboardingTierId) {
      toast.error("Choose a monthly plan and an onboarding option to continue.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscriptionTierId,
          onboardingTierId,
          billingInterval,
          promoCode: promoCode.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        throw new Error(data.error ?? "Couldn't start checkout.");
      }
      window.location.href = data.url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't start checkout.");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-heading text-lg font-semibold">
            1. Choose your plan
          </h2>
          <div className="inline-flex items-center rounded-full border border-border bg-card p-1">
            <button
              type="button"
              onClick={() => setBillingInterval("monthly")}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                billingInterval === "monthly"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setBillingInterval("annual")}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                billingInterval === "annual"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Annual
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                  billingInterval === "annual"
                    ? "bg-primary-foreground/20"
                    : "bg-primary/10 text-primary",
                )}
              >
                Save 17%
              </span>
            </button>
          </div>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {subscriptionTiers.map((tier) => (
            <TierCard
              key={tier.id}
              tier={tier}
              price={
                billingInterval === "annual" ? tier.annualPriceLabel : tier.priceLabel
              }
              cadence={billingInterval === "annual" ? "/year" : tier.cadence}
              subCaption={
                billingInterval === "annual"
                  ? tier.annualMonthlyEquivalentLabel
                  : undefined
              }
              selected={subscriptionTierId === tier.id}
              onSelect={() => setSubscriptionTierId(tier.id)}
            />
          ))}
        </div>
      </div>

      <div>
        <h2 className="font-heading text-lg font-semibold">
          2. Choose your onboarding
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          A one-time fee, chosen once when you set up your account.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {onboardingTiers.map((tier) => (
            <TierCard
              key={tier.id}
              tier={tier}
              price={tier.priceLabel}
              selected={onboardingTierId === tier.id}
              onSelect={() => setOnboardingTierId(tier.id)}
            />
          ))}
        </div>
      </div>

      <div>
        {showPromoField ? (
          <div className="flex max-w-xs items-center gap-2">
            <Tag className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Promo code"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value)}
              className="h-9"
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowPromoField(true)}
            className="text-xs text-muted-foreground underline-offset-2 hover:text-primary hover:underline"
          >
            Have a promo code?
          </button>
        )}
      </div>

      <Button
        size="lg"
        onClick={handleCheckout}
        disabled={loading || !subscriptionTierId || !onboardingTierId}
        className="w-full sm:w-auto"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        Continue to secure payment
      </Button>
    </div>
  );
}
