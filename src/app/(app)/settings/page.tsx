import { createClient } from "@/lib/supabase/server";
import { requireActiveOrg, requireUser, canChangeRoles, type MemberRole } from "@/lib/data/orgs";
import { isSoloAccountTier } from "@/lib/marketing/pricing";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MyTechIdentityCard } from "@/components/settings/my-tech-identity-card";
import { TechNamesCard } from "@/components/settings/tech-names-card";
import { MemberRoleSelect } from "@/components/settings/member-role-select";
import { InviteMemberDialog } from "@/components/settings/invite-member-dialog";
import { PendingInvitesCard } from "@/components/settings/pending-invites-card";
import { RemoveMemberButton } from "@/components/settings/remove-member-button";
import { JoinCodeCard } from "@/components/settings/join-code-card";
import { InstallManagerCard } from "./install-manager-card";
import { InstallTeamCard } from "./install-team-card";
import { ServiceManagerCard } from "./service-manager-card";
import { ServiceTeamCard } from "./service-team-card";
import { OfficeRolesCard } from "./office-roles-card";
import { RunnerTeamCard } from "./runner-team-card";
import { TeamJoinQrCard } from "./team-join-qr-card";
import { PendingRoleRequestsCard } from "./pending-role-requests-card";
import { WarehouseNotifyCard } from "./warehouse-notify-card";
import Link from "next/link";
import { canManageOrg } from "@/lib/data/orgs";
import { getOrgInvites } from "@/lib/data/invites";
import { getAllTechNames } from "@/lib/data/tech-names";
import { formatTechLabel } from "@/lib/tech-labels";
import { permitTechSlots } from "@/lib/inventory/constants";
import { hoaTechSlots } from "@/lib/hoa/constants";
import type { AssignedRoleRow } from "@/lib/assigned-roles";

const D365_ERROR_MESSAGES: Record<string, string> = {
  missing_code: "Microsoft didn't return an authorization code. Try connecting again.",
  bad_state: "That connection link expired or was tampered with. Try connecting again.",
  nonce_mismatch: "That connection link expired. Try connecting again.",
  token_exchange_failed: "Microsoft rejected the connection. Try again, or check the environment URL.",
  access_denied: "The Dynamics 365 sign-in was cancelled.",
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ d365?: string; reason?: string; mail?: string }>;
}) {
  const { d365, reason, mail } = await searchParams;
  const user = await requireUser();
  const { activeOrg, role, permitTechLabel, hoaTechLabel } = await requireActiveOrg();
  const supabase = await createClient();
  const isSolo = isSoloAccountTier(activeOrg.subscription_tier);

  const { data: members } = await supabase
    .from("organization_members")
    .select("id, role, user_id, created_at, permit_tech_label, hoa_tech_label")
    .eq("org_id", activeOrg.id)
    .order("created_at");

  const memberIds = members?.map((m) => m.user_id) ?? [];
  const { data: profiles } = memberIds.length
    ? await supabase.from("profiles").select("id, email, full_name").in("id", memberIds)
    : { data: [] as { id: string; email: string; full_name: string | null }[] };
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  const canEditRoles = canChangeRoles(role);
  const canInvite = canManageOrg(role);
  const canManageTechNames = role === "owner" || role === "admin";
  const pendingOrgInvites = canInvite ? await getOrgInvites(activeOrg.id) : [];
  const techNames = await getAllTechNames(activeOrg.id);

  let joinCode: string | null = null;
  try {
    const raw = supabase as unknown as {
      from: (table: string) => {
        select: (cols: string) => {
          eq: (col: string, val: string) => {
            maybeSingle: () => Promise<{ data: { join_code: string | null } | null }>;
          };
        };
      };
    };
    const { data } = await raw.from("organizations").select("join_code").eq("id", activeOrg.id).maybeSingle();
    joinCode = data?.join_code ?? null;
  } catch {
    joinCode = null;
  }

  // crm_connections isn't in the generated Database type yet — cast until
  // `supabase gen types typescript` is re-run (same pattern as join_code
  // above). RLS restricts this table to org admins, so a non-admin caller
  // would get nothing back even without the `canInvite` guard.
  let crmConnection: { status: string; environment_url: string; last_error: string | null } | null = null;
  if (canInvite) {
    try {
      const raw = supabase as unknown as {
        from: (table: string) => {
          select: (cols: string) => {
            eq: (col: string, val: string) => {
              eq: (
                col: string,
                val: string,
              ) => {
                maybeSingle: () => Promise<{
                  data: { status: string; environment_url: string; last_error: string | null } | null;
                }>;
              };
            };
          };
        };
      };
      const { data } = await raw
        .from("crm_connections")
        .select("status, environment_url, last_error")
        .eq("org_id", activeOrg.id)
        .eq("provider", "dynamics365")
        .maybeSingle();
      crmConnection = data ?? null;
    } catch {
      crmConnection = null;
    }
  }

  let installRoster: { id: string; email: string; role: string; display_name?: string | null }[] = [];
  let serviceRoster: { id: string; email: string; role: string; display_name?: string | null }[] = [];
  let runnerRoster: { id: string; email: string; display_name?: string | null }[] = [];
  let assignedRoles: AssignedRoleRow[] = [];
  let warehouseEmails = "";
  if (canInvite) {
    try {
      const raw = supabase as unknown as {
        from: (table: string) => {
          select: (cols: string) => {
            eq: (col: string, val: string) => Promise<{ data: unknown[] | null }>;
          };
        };
      };
      const { data } = await raw
        .from("install_members")
        .select("id, email, role, display_name")
        .eq("org_id", activeOrg.id);
      installRoster = (data ?? []) as { id: string; email: string; role: string; display_name?: string | null }[];
      const service = await raw
        .from("service_members")
        .select("id, email, role, display_name")
        .eq("org_id", activeOrg.id);
      serviceRoster = (service.data ?? []) as { id: string; email: string; role: string; display_name?: string | null }[];
      const runners = await raw.from("runner_members").select("id, email, display_name").eq("org_id", activeOrg.id);
      runnerRoster = (runners.data ?? []) as { id: string; email: string; display_name?: string | null }[];
      const assigned = await raw.from("assigned_roles").select("id, email, role, tech_slot").eq("org_id", activeOrg.id);
      assignedRoles = (assigned.data ?? []) as AssignedRoleRow[];
      const settings = await raw.from("warehouse_settings").select("notify_email").eq("org_id", activeOrg.id);
      warehouseEmails = ((settings.data ?? [])[0] as { notify_email?: string } | undefined)?.notify_email ?? "";
    } catch {
      installRoster = [];
      serviceRoster = [];
      runnerRoster = [];
      assignedRoles = [];
    }
  }
  const installManagers = installRoster.filter((m) => m.role === "install_manager");
  const restOfInstallTeam = installRoster.filter((m) => m.role !== "install_manager");
  const serviceManagers = serviceRoster.filter((m) => m.role === "service_manager");
  const restOfServiceTeam = serviceRoster.filter((m) => m.role !== "service_manager");

  let pendingRoleRequests: { id: string; user_id: string; email: string; requested_role: string; created_at: string }[] = [];
  if (canInvite) {
    try {
      const raw = supabase as unknown as {
        from: (table: string) => {
          select: (cols: string) => {
            eq: (col: string, val: string) => {
              eq: (col: string, val: string) => Promise<{ data: unknown[] | null }>;
            };
          };
        };
      };
      const { data } = await raw
        .from("role_join_requests")
        .select("id, user_id, email, requested_role, created_at")
        .eq("org_id", activeOrg.id)
        .eq("status", "pending");
      pendingRoleRequests = (data ?? []) as typeof pendingRoleRequests;
    } catch {
      pendingRoleRequests = [];
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Organization</p>
          <h1 className="mt-1 font-heading text-2xl font-semibold tracking-tight">
            Settings
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage your organization and team.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 print:hidden">
          <Link
            href="/settings/ask"
            className="text-sm font-medium text-primary underline-offset-2 hover:underline"
          >
            Print Ask PermitAIO how-to
          </Link>
          <Link
            href="/settings/playbook"
            className="text-sm font-medium text-primary underline-offset-2 hover:underline"
          >
            Print role tutorials
          </Link>
          <Link
            href="/settings/agents"
            className="text-sm font-medium text-primary underline-offset-2 hover:underline"
          >
            Agent workbook
          </Link>
        </div>
      </div>

      {mail ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {mail}
        </p>
      ) : null}

      {d365 === "connected" && (
        <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Dynamics 365 connected.
        </div>
      )}
      {d365 === "error" && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {(reason && D365_ERROR_MESSAGES[reason]) || "Couldn't connect Dynamics 365. Try again."}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-heading">Organization</CardTitle>
          <CardDescription>Basic company details.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Name</p>
            <p className="font-medium">{activeOrg.name}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Plan</p>
            <p className="font-medium capitalize">{activeOrg.plan}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Workspace URL</p>
            <p className="font-medium">permitaio.com/{activeOrg.slug}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Your role</p>
            <Badge variant="secondary" className="capitalize">
              {role}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {!isSolo && canInvite ? <JoinCodeCard code={joinCode} /> : null}

      {!isSolo && canInvite ? <TeamJoinQrCard hasCode={Boolean(joinCode)} /> : null}

      {canInvite ? (
        <PendingRoleRequestsCard
          requests={pendingRoleRequests}
          permitTechSlots={permitTechSlots(activeOrg.permit_tech_seats)}
          hoaTechSlots={hoaTechSlots(activeOrg.hoa_tech_seats)}
        />
      ) : null}

      {canInvite ? (
        <InstallManagerCard
          managers={installManagers}
          people={(profiles ?? []).map((p) => ({
            email: p.email,
            name: p.full_name || p.email,
          }))}
        />
      ) : null}

      {canInvite ? <InstallTeamCard roster={restOfInstallTeam} /> : null}

      {canInvite ? (
        <ServiceManagerCard
          managers={serviceManagers}
          people={(profiles ?? []).map((p) => ({
            email: p.email,
            name: p.full_name || p.email,
          }))}
        />
      ) : null}

      {canInvite ? <ServiceTeamCard roster={restOfServiceTeam} /> : null}

      {canInvite ? <RunnerTeamCard roster={runnerRoster} /> : null}

      {canInvite ? (
        <OfficeRolesCard
          roster={assignedRoles}
          permitSlots={permitTechSlots(activeOrg.permit_tech_seats)}
          hoaSlots={hoaTechSlots(activeOrg.hoa_tech_seats)}
        />
      ) : null}

      {canInvite ? <WarehouseNotifyCard emails={warehouseEmails} /> : null}

      {canInvite ? (
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-base">Agent workbook</CardTitle>
            <CardDescription>
              How the desks work, how you teach them, and blank boxes for your notes. Autosaves on this
              phone. Print or download your notes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/settings/agents"
              className="inline-flex h-10 items-center rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground"
            >
              Open workbook
            </Link>
          </CardContent>
        </Card>
      ) : null}

      {canInvite && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-heading">CRM Integrations</CardTitle>
            <CardDescription>
              Connect your own Dynamics 365 to push PermitAIO jobs there automatically.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {crmConnection?.status === "active" ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Dynamics 365</p>
                  <p className="text-xs text-muted-foreground">{crmConnection.environment_url}</p>
                </div>
                <Badge variant="secondary">Connected</Badge>
              </div>
            ) : (
              <form action="/api/integrations/dynamics365/connect" method="get" className="flex items-end gap-2">
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor="environmentUrl">Dynamics 365 environment URL</Label>
                  <Input
                    id="environmentUrl"
                    name="environmentUrl"
                    type="url"
                    placeholder="https://yourorg.crm.dynamics.com"
                    required
                  />
                </div>
                <Button type="submit">Connect</Button>
              </form>
            )}
            {crmConnection?.status === "error" && (
              <p className="text-xs text-destructive">
                Last sync error: {crmConnection.last_error ?? "unknown error"}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <MyTechIdentityCard permitTechLabel={permitTechLabel} hoaTechLabel={hoaTechLabel} />

      <TechNamesCard
        canEdit={canManageTechNames}
        initialPermit={techNames.permit}
        initialHoa={techNames.hoa}
      />

      {!isSolo && canInvite && <PendingInvitesCard invites={pendingOrgInvites} />}

      {!isSolo && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base font-heading">Team</CardTitle>
              <CardDescription>
                Owners, admins, managers, and members. Invite or delete from this company.
              </CardDescription>
            </div>
            {canInvite && <InviteMemberDialog />}
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Permit tech</TableHead>
                  <TableHead>HOA tech</TableHead>
                  {canInvite ? <TableHead className="text-right"> </TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {members?.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">
                      {profileById.get(m.user_id)?.full_name ||
                        profileById.get(m.user_id)?.email ||
                        (m.user_id === user.id ? user.email : null) ||
                        "Unknown user"}
                      {m.user_id === user.id && (
                        <span className="ml-1.5 font-normal text-muted-foreground">(You)</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {canEditRoles ? (
                        <MemberRoleSelect memberId={m.id} currentRole={m.role as MemberRole} />
                      ) : (
                        <Badge variant="outline" className="capitalize">
                          {m.role}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {m.permit_tech_label
                        ? formatTechLabel(m.permit_tech_label, techNames.permit)
                        : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {m.hoa_tech_label
                        ? formatTechLabel(m.hoa_tech_label, techNames.hoa)
                        : "—"}
                    </TableCell>
                    {canInvite ? (
                      <TableCell className="text-right">
                        {m.user_id === user.id ? null : <RemoveMemberButton memberId={m.id} />}
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
