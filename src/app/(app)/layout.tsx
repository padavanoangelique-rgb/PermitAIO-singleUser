import { redirect } from "next/navigation";
import { requireUser, requireActiveOrg, isOrgBillingBlocked, canAccessAccounting } from "@/lib/data/orgs";
import { isPlatformAdmin } from "@/lib/data/platform-admin";
import { isCompanyInstallAdmin } from "@/lib/data/install-access";
import { createClient } from "@/lib/supabase/server";
import { permitTechSlots } from "@/lib/inventory/constants";
import { hoaTechSlots } from "@/lib/hoa/constants";
import { TechSlotsProvider } from "@/components/tech-slots-provider";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { UserMenu } from "@/components/user-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { Separator } from "@/components/ui/separator";
import { GlobalSearch } from "@/components/global-search";
import { HeaderBackToJob } from "@/components/header-back-to-job";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { MessageTeammateButton } from "@/components/notifications/message-teammate-button";
import { getAllTechNames } from "@/lib/data/tech-names";
import { getPendingInvitesForCurrentUser } from "@/lib/data/invites";
import { PendingInvitesBanner } from "@/components/invites/pending-invites-banner";
import { PermitBots } from "@/components/permit-bots";

async function computeRestrictToInstall(userEmail: string | null | undefined, userId: string, orgId: string) {
  const supabase = await createClient();
  const db = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => { eq: (a: string, b: string) => Promise<{ data: { email: string; user_id: string | null }[] | null; error: unknown }> };
    };
  };
  try {
    const { data } = await db.from("install_members").select("email, user_id").eq("org_id", orgId);
    const myEmail = (userEmail ?? "").toLowerCase();
    return (data ?? []).some((m) => m.email.toLowerCase() === myEmail || m.user_id === userId);
  } catch {
    return false;
  }
}

/** Same idea as computeRestrictToInstall, for the Permit Runner module —
* a base "member" whose only foothold in the org is a runner_members row
* gets the sidebar cut down to just Permit Runner. */
async function computeRestrictToRunner(userEmail: string | null | undefined, userId: string, orgId: string) {
  const supabase = await createClient();
  const db = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => { eq: (a: string, b: string) => Promise<{ data: { email: string; user_id: string | null }[] | null; error: unknown }> };
    };
  };
  try {
    const { data } = await db.from("runner_members").select("email, user_id").eq("org_id", orgId);
    const myEmail = (userEmail ?? "").toLowerCase();
    return (data ?? []).some((m) => m.email.toLowerCase() === myEmail || m.user_id === userId);
  } catch {
    return false;
  }
}

async function computeRestrictToService(userEmail: string | null | undefined, userId: string, orgId: string) {
  const supabase = await createClient();
  const db = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => { eq: (a: string, b: string) => Promise<{ data: { email: string; user_id: string | null }[] | null; error: unknown }> };
    };
  };
  try {
    const { data } = await db.from("service_members").select("email, user_id").eq("org_id", orgId);
    const myEmail = (userEmail ?? "").toLowerCase();
    return (data ?? []).some((m) => m.email.toLowerCase() === myEmail || m.user_id === userId);
  } catch {
    return false;
  }
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const { memberships, activeOrg, role, permitTechLabel, hoaTechLabel } = await requireActiveOrg();
  const isAdmin = await isPlatformAdmin();
  const pendingInvites = await getPendingInvitesForCurrentUser();
  const techNames = await getAllTechNames(activeOrg.id);

if (isOrgBillingBlocked(activeOrg)) {
  redirect("/billing?expired=1");
}

const orgManager = role === "owner" || role === "admin" || role === "manager";
  const companyAdmin = isCompanyInstallAdmin(user.email, role);
  // A base "member" whose only foothold in this org is an install role (account
// manager, PM, installer, or install manager) gets the sidebar cut down to just
// Install Dashboard — everyone else (owners/admins/managers/company admins,
// and platform admins) keeps the full app.
const restrictToInstall =
  !orgManager && !companyAdmin && !isAdmin && (await computeRestrictToInstall(user.email, user.id, activeOrg.id));
  // Same cut-down treatment for a base member whose only foothold is the
// Permit Runner role — checked after install so an install role (rare to
// overlap, but possible) takes priority.
const restrictToRunner =
  !orgManager &&
  !companyAdmin &&
  !isAdmin &&
  !restrictToInstall &&
  (await computeRestrictToRunner(user.email, user.id, activeOrg.id));
  const restrictToService =
    !orgManager &&
    !companyAdmin &&
    !isAdmin &&
    !restrictToInstall &&
    !restrictToRunner &&
    (await computeRestrictToService(user.email, user.id, activeOrg.id));

const style = {
  "--sidebar-width": "16rem",
  "--sidebar-width-icon": "3.5rem",
} as React.CSSProperties;

return (
  <TechSlotsProvider
    permitTechs={permitTechSlots(activeOrg.permit_tech_seats)}
    hoaTechs={hoaTechSlots(activeOrg.hoa_tech_seats)}
    permitNames={techNames.permit}
    hoaNames={techNames.hoa}
    >
  <SidebarProvider defaultOpen={false} style={style}>
  <div className="flex h-screen w-full print:block print:h-auto">
  <div className="print:hidden">
  <AppSidebar
    memberships={memberships}
    activeSlug={activeOrg.slug}
    showInstall
    restrictToInstall={restrictToInstall}
    showRunner
    restrictToRunner={restrictToRunner}
    showService
    restrictToService={restrictToService}
    showAccounting={canAccessAccounting(role) || isAdmin}
    />
  </div>
  <div className="flex flex-1 flex-col overflow-hidden print:block print:overflow-visible">
  <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b bg-background px-3 sm:px-4 print:hidden">
  <div className="flex min-w-0 items-center gap-2">
  <SidebarTrigger />
  <Separator orientation="vertical" className="h-5" />
  <span className="hidden truncate text-sm font-medium text-muted-foreground sm:inline">
    {activeOrg.name}
  </span>
  </div>
  <div className="flex shrink-0 items-center gap-1.5 sm:gap-2 print:hidden">
  <HeaderBackToJob />
  <GlobalSearch orgId={activeOrg.id} />
  <NotificationBell orgId={activeOrg.id} permitTech={permitTechLabel} userId={user.id} />
  <ThemeToggle />
  <UserMenu email={user.email ?? ""} role={role} isPlatformAdmin={isAdmin} />
  </div>
  </header>
  <main className="flex-1 overflow-auto bg-muted/20 p-6 print:overflow-visible print:p-0 print:bg-white">
    {pendingInvites.length > 0 && (
      <div className="mb-4 print:hidden">
      <PendingInvitesBanner invites={pendingInvites} />
      </div>
  )}
    {children}
  </main>
  </div>
  </div>
  <PermitBots
    desks={{
      main: true,
      permit: Boolean(permitTechLabel) || orgManager || isAdmin,
      corrections: Boolean(permitTechLabel) || orgManager || isAdmin,
      hoa: Boolean(hoaTechLabel) || orgManager || isAdmin,
      support: true,
    }}
    />
  <MessageTeammateButton />
  </SidebarProvider>
  </TechSlotsProvider>
  );
}
