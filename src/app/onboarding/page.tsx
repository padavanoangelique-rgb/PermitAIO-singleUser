import { requireUser, getUserMemberships } from "@/lib/data/orgs";
import { isPlatformAdmin } from "@/lib/data/platform-admin";
import { getPendingInvitesForCurrentUser } from "@/lib/data/invites";
import { redirect } from "next/navigation";
import { OnboardingForm } from "./onboarding-form";
import { PendingInvitesBanner } from "@/components/invites/pending-invites-banner";

export default async function OnboardingPage() {
  await requireUser();
  // Platform admins never onboard — they run the platform, not an org.
  if (await isPlatformAdmin()) {
    redirect("/admin");
  }
  const memberships = await getUserMemberships();
  if (memberships.length > 0) {
    redirect("/dashboard");
  }

  const pendingInvites = await getPendingInvitesForCurrentUser();

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-12">
      <div className="w-full max-w-md space-y-4">
        {pendingInvites.length > 0 && (
          <div className="space-y-2">
            <PendingInvitesBanner invites={pendingInvites} />
            <p className="text-center text-xs text-muted-foreground">
              Accept an invite above to join that team, or set up your own company below.
            </p>
          </div>
        )}
        <OnboardingForm />
      </div>
    </div>
  );
}
