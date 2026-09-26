import type { Metadata } from "next";
import { requireUser, requireActiveOrg, isOrgBillingBlocked, canManageOrg } from "@/lib/data/orgs";
import { signOut } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { BillingSelector } from "@/components/billing/billing-selector";
import { TRIAL_DAYS } from "@/lib/marketing/pricing";

export const metadata: Metadata = {
  title: "Billing",
};

function daysRemaining(trialEndsAt: string | null): number | null {
  if (!trialEndsAt) return null;
  const ms = new Date(trialEndsAt).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const user = await requireUser();
  const { activeOrg, role } = await requireActiveOrg();
  const params = await searchParams;

  const blocked = isOrgBillingBlocked(activeOrg);
  const isActive = activeOrg.subscription_status === "active";
  const isComped = activeOrg.subscription_status === "comped";
  const daysLeft = daysRemaining(activeOrg.trial_ends_at);
  const canManage = canManageOrg(role);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Billing — {activeOrg.name}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Signed in as {user.email}
        </p>
      </div>

      {params.checkout === "success" && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-foreground">
          Payment received — your subscription is now active. It may take a
          few seconds to reflect below.
        </div>
      )}
      {params.checkout === "cancelled" && (
        <div className="rounded-lg border border-border bg-secondary/40 px-4 py-3 text-sm text-muted-foreground">
          Checkout was cancelled — no charge was made.
        </div>
      )}
      {params.expired === "1" && !isActive && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-foreground">
          Your free trial has ended. Choose a plan below to keep using
          PermitAIO.
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="font-heading text-lg font-semibold">
          Current status
        </h2>
        {isComped ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Complimentary access — no charge, no card on file. Enjoy the full
            product with the compliments of the PermitAIO team.
          </p>
        ) : isActive ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Subscription active
            {activeOrg.subscription_tier ? ` — ${activeOrg.subscription_tier} plan` : ""}
            . Thanks for being a PermitAIO customer.
          </p>
        ) : blocked ? (
          <p className="mt-2 text-sm text-destructive">
            Your access is paused. Choose a plan below to reactivate your
            account — your data is safe and will be right where you left it.
          </p>
        ) : daysLeft !== null && daysLeft >= 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            {daysLeft === 0
              ? "Your free trial ends today."
              : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left in your ${TRIAL_DAYS}-day free trial.`}{" "}
            Choose a plan any time to continue without interruption.
          </p>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            Choose a plan to activate your subscription.
          </p>
        )}
      </div>

      {isComped ? null : canManage ? (
        <BillingSelector
          initialSubscriptionTier={activeOrg.subscription_tier}
          initialOnboardingTier={activeOrg.onboarding_tier}
        />
      ) : (
        <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Only an owner or admin can manage billing for this organization.
          Ask your organization owner to choose a plan.
        </div>
      )}

      <form action={signOut}>
        <Button type="submit" variant="ghost" size="sm">
          Sign out
        </Button>
      </form>
    </div>
  );
}
