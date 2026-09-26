import Link from "next/link";
import { getAdminOverview, type AdminOrgRow } from "@/lib/data/platform-admin";
import { getSubscriptionTier, getOnboardingTier } from "@/lib/marketing/pricing";
import { AdminKpiStrip } from "@/components/admin/admin-kpi-strip";
import { Badge } from "@/components/ui/badge";
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
import { AlertTriangle } from "lucide-react";

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function trialLabel(row: AdminOrgRow): string {
  const status = row.subscription_status ?? "trialing";
  if (status !== "trialing" || !row.trial_ends_at) return "—";
  const daysLeft = Math.ceil(
    (new Date(row.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );
  if (daysLeft < 0) return "Expired";
  if (daysLeft === 0) return "Ends today";
  return `${daysLeft}d left`;
}

function StatusBadge({ status }: { status: string | null }) {
  const s = status ?? "trialing";
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    trialing: { label: "Trialing", variant: "outline" },
    active: { label: "Active", variant: "default" },
    past_due: { label: "Past due", variant: "secondary" },
    canceled: { label: "Canceled", variant: "destructive" },
    unpaid: { label: "Unpaid", variant: "destructive" },
    incomplete_expired: { label: "Expired", variant: "destructive" },
    comped: { label: "Comped (free)", variant: "secondary" },
  };
  const entry = map[s] ?? { label: s, variant: "outline" as const };
  return <Badge variant={entry.variant}>{entry.label}</Badge>;
}

export default async function AdminOverviewPage() {
  const { orgs, totals, configError } = await getAdminOverview();

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">
          Owner console
        </h1>
        <p className="text-sm text-muted-foreground">
          Every organization on PermitAIO, at a glance. Visible only to platform admins.
        </p>
      </div>

      {configError ? (
        <Card className="border-amber-300 bg-amber-50 py-0 dark:border-amber-900 dark:bg-amber-950/30">
          <CardContent className="flex items-start gap-3 py-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="text-sm">
              <p className="font-medium text-amber-900 dark:text-amber-200">
                Owner console needs the service-role key
              </p>
              <p className="mt-1 text-amber-800 dark:text-amber-300">
                Add <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs dark:bg-amber-900">SUPABASE_SERVICE_ROLE_KEY</code> to this environment&apos;s variables (Vercel → Project Settings → Environment Variables) to see cross-org data here. See the README for details.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <AdminKpiStrip
        orgCount={totals.orgCount}
        trialingCount={totals.trialingCount}
        activeCount={totals.activeCount}
        pastDueCount={totals.pastDueCount}
        canceledCount={totals.canceledCount}
        compedCount={totals.compedCount}
        mrr={totals.mrr}
      />

      <Card className="py-0">
        <CardHeader className="pt-4">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            One-time onboarding revenue collected
          </CardTitle>
          <CardDescription className="font-heading text-2xl font-semibold text-foreground">
            {formatMoney(totals.onboardingRevenue)}
          </CardDescription>
        </CardHeader>
        <CardContent className="pb-4 text-xs text-muted-foreground">
          Sum of paid Self-Serve ($499), Standard ($999), and White-Glove ($1,999) onboarding fees, across every org.
        </CardContent>
      </Card>

      <Card className="py-0">
        <CardHeader className="pt-4">
          <CardTitle className="text-base">Organizations</CardTitle>
          <CardDescription>Sorted newest first.</CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-2">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organization</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Trial</TableHead>
                  <TableHead>Subscription</TableHead>
                  <TableHead>Onboarding</TableHead>
                  <TableHead className="text-right">Members</TableHead>
                  <TableHead className="text-right">Jobs</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Manage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orgs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="py-8 text-center text-sm text-muted-foreground">
                      No organizations yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  orgs.map((org) => {
                    const subTier = org.subscription_tier
                      ? getSubscriptionTier(org.subscription_tier)
                      : undefined;
                    const onboardTier = org.onboarding_tier
                      ? getOnboardingTier(org.onboarding_tier)
                      : undefined;
                    return (
                      <TableRow key={org.id}>
                        <TableCell className="font-medium">
                          <div className="flex flex-col">
                            <span>{org.name}</span>
                            <span className="text-xs text-muted-foreground">/{org.slug}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {org.owner_email ?? "—"}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={org.subscription_status} />
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {trialLabel(org)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {subTier ? `${subTier.name} · ${subTier.priceLabel}/mo` : "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {onboardTier ? (
                            <span className={org.onboarding_paid ? "" : "text-muted-foreground"}>
                              {onboardTier.name}
                              {org.onboarding_paid ? "" : " (unpaid)"}
                            </span>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{org.member_count}</TableCell>
                        <TableCell className="text-right tabular-nums">{org.job_count}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(org.created_at)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Link
                            href={`/admin/trials?org=${org.slug}`}
                            className="text-sm font-medium text-primary hover:underline"
                          >
                            Trials &amp; Billing →
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
