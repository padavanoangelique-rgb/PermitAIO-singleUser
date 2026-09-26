import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { subscriptionTiers, onboardingTiers, soloOwnerTier } from "@/lib/marketing/pricing";
import { cn } from "@/lib/utils";

export function PricingCards() {
  return (
    <div className="grid gap-6 md:grid-cols-3">
      {subscriptionTiers.map((tier) => (
        <div
          key={tier.name}
          className={cn(
            "relative flex flex-col rounded-2xl border p-8",
            tier.highlighted
              ? "border-primary bg-card shadow-lg ring-1 ring-primary/20"
              : "border-border bg-card",
          )}
        >
          {tier.highlighted && (
            <span className="absolute -top-3 left-8 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
              Most popular
            </span>
          )}

          <h3 className="font-heading text-lg font-semibold">{tier.name}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {tier.description}
          </p>

          <div className="mt-6 flex items-baseline gap-1">
            <span className="font-heading text-4xl font-semibold tracking-tight">
              {tier.priceLabel}
            </span>
            {tier.cadence && (
              <span className="text-sm text-muted-foreground">
                {tier.cadence}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs font-medium text-muted-foreground">
            + {tier.onboardingPriceLabel} (required)
          </p>

          <Button
            asChild
            size="lg"
            variant={tier.highlighted ? "default" : "outline"}
            className="mt-6"
          >
            <Link href={tier.ctaHref}>{tier.cta}</Link>
          </Button>

          <ul className="mt-8 space-y-3 text-sm">
            {tier.features.map((feature) => (
              <li key={feature} className="flex items-start gap-2.5">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span className="text-foreground/90">{feature}</span>
              </li>
            ))}
          </ul>

          <div className="mt-6 rounded-lg border border-border/60 bg-muted/40 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Onboarding included
            </p>
            <ul className="mt-2 space-y-1.5 text-xs">
              {tier.onboardingSummary.map((item) => (
                <li key={item} className="flex items-start gap-1.5">
                  <span
                    aria-hidden
                    className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/70"
                  />
                  <span className="text-foreground/80">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ))}
    </div>
  );
}

export function OnboardingTierCards() {
  return (
    <div className="grid gap-6 md:grid-cols-3">
      {onboardingTiers.map((tier) => (
        <div
          key={tier.id}
          className={cn(
            "relative flex flex-col rounded-2xl border p-6",
            tier.recommended
              ? "border-primary bg-card shadow-md ring-1 ring-primary/20"
              : "border-border bg-card",
          )}
        >
          {tier.recommended && (
            <span className="absolute -top-3 left-6 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
              Most chosen
            </span>
          )}

          <h4 className="font-heading text-base font-semibold">
            {tier.name}
          </h4>
          <p className="mt-1 text-sm text-muted-foreground">
            {tier.description}
          </p>

          <div className="mt-4 flex items-baseline gap-1">
            <span className="font-heading text-2xl font-semibold tracking-tight">
              {tier.priceLabel}
            </span>
            <span className="text-xs text-muted-foreground">one-time</span>
          </div>

          <ul className="mt-5 space-y-2.5 text-sm">
            {tier.features.map((feature) => (
              <li key={feature} className="flex items-start gap-2.5">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span className="text-foreground/90">{feature}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** Solo Owner is deliberately not part of `subscriptionTiers`, so it's
 * rendered by its own card rather than in the 3-column grid above — same
 * markup as a tier card in PricingCards, showing `soloOwnerTier` alone. */
export function SoloOwnerCard() {
  const tier = soloOwnerTier;
  return (
    <div className="relative flex flex-col rounded-2xl border border-border bg-card p-8">
      <h3 className="font-heading text-lg font-semibold">{tier.name}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{tier.description}</p>

      <div className="mt-6 flex items-baseline gap-1">
        <span className="font-heading text-4xl font-semibold tracking-tight">
          {tier.priceLabel}
        </span>
        {tier.cadence && (
          <span className="text-sm text-muted-foreground">{tier.cadence}</span>
        )}
      </div>
      <p className="mt-1 text-xs font-medium text-muted-foreground">
        + {tier.onboardingPriceLabel} (required)
      </p>

      <Button asChild size="lg" variant="outline" className="mt-6">
        <Link href={tier.ctaHref}>{tier.cta}</Link>
      </Button>

      <ul className="mt-8 space-y-3 text-sm">
        {tier.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2.5">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span className="text-foreground/90">{feature}</span>
          </li>
        ))}
      </ul>

      <div className="mt-6 rounded-lg border border-border/60 bg-muted/40 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Onboarding included
        </p>
        <ul className="mt-2 space-y-1.5 text-xs">
          {tier.onboardingSummary.map((item) => (
            <li key={item} className="flex items-start gap-1.5">
              <span
                aria-hidden
                className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/70"
              />
              <span className="text-foreground/80">{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
