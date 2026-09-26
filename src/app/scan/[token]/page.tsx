import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser, requireActiveOrg } from "@/lib/data/orgs";
import { checkInstallJob } from "@/app/(app)/install/actions";
import { scanAdvancePermitCustody } from "@/lib/permit-custody/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function adminTable(admin: ReturnType<typeof createAdminClient>, table: string) {
  return (admin as unknown as { from: (t: string) => any }).from(table);
}

const STATUS_LABEL: Record<string, string> = {
  not_printed: "Not printed yet",
  in_library: "In library — ready for pickup",
  checked_out: "Checked out",
  checked_in: "Checked in at job site",
};

/**
 * Landing page for every scanned job sticker — same QR whether it's read
 * by a phone's own camera app (which just opens this URL, no in-app
 * scanner needed) for a permit handoff or a warehouse pull. Always shows
 * which job this is; shows the permit custody action only when there's
 * something to do, and a PM check-in shortcut when this user is that
 * job's assigned PM.
 */
export default async function ScanPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  await requireUser();
  const { activeOrg } = await requireActiveOrg();

  const admin = createAdminClient();
  const { data: tokenRow } = await adminTable(admin, "job_scan_tokens")
    .select("job_id, org_id")
    .eq("token", token)
    .maybeSingle();

  if (!tokenRow) {
    return (
      <div className="mx-auto max-w-md space-y-3 p-6">
        <h1 className="font-heading text-xl">Sticker not recognized</h1>
        <p className="text-sm text-muted-foreground">This QR code doesn&apos;t match any job. It may have been reprinted — try the newest sticker for this job.</p>
      </div>
    );
  }

  if (tokenRow.org_id !== activeOrg.id) {
    return (
      <div className="mx-auto max-w-md space-y-3 p-6">
        <h1 className="font-heading text-xl">Different workspace</h1>
        <p className="text-sm text-muted-foreground">
          This job belongs to a different company workspace than the one you&apos;re currently signed into. Switch workspaces (top of the sidebar) and scan again.
        </p>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: job } = await supabase
    .from("jobs")
    .select("id, job_number, client_name, address, city, permit_tech")
    .eq("org_id", activeOrg.id)
    .eq("id", tokenRow.job_id)
    .maybeSingle();

  if (!job) {
    return (
      <div className="mx-auto max-w-md space-y-3 p-6">
        <h1 className="font-heading text-xl">Job not found</h1>
        <p className="text-sm text-muted-foreground">This job may have been removed.</p>
      </div>
    );
  }

  const { data: custody } = await adminTable(admin, "permit_custody")
    .select("status, current_holder_name, checked_out_at, checked_in_at")
    .eq("job_id", job.id)
    .maybeSingle();
  const status = custody?.status ?? "not_printed";

  const { data: authUser } = await supabase.auth.getUser();
  const userId = authUser.user?.id ?? "";
  const { data: assignment } = await adminTable(admin, "install_job_assignments")
    .select("pm_id, pm_checked_at")
    .eq("org_id", activeOrg.id)
    .eq("job_id", job.id)
    .maybeSingle();
  let isAssignedPm = false;
  if (assignment?.pm_id && userId) {
    const { data: pmMember } = await adminTable(admin, "install_members")
      .select("id")
      .eq("id", assignment.pm_id)
      .eq("user_id", userId)
      .maybeSingle();
    isAssignedPm = Boolean(pmMember);
  }

  const returnTo = `/scan/${token}`;

  return (
    <div className="mx-auto max-w-md space-y-4 p-6">
      <div>
        <p className="font-mono text-xs text-muted-foreground">{job.job_number}</p>
        <h1 className="font-heading text-2xl">{job.client_name}</h1>
        <p className="text-sm text-muted-foreground">{[job.address, job.city].filter(Boolean).join(", ") || "No address"}</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-heading text-base">Printed permit</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm">{STATUS_LABEL[status] ?? status}</p>
          {status === "checked_out" && custody?.current_holder_name ? (
            <p className="text-xs text-muted-foreground">Currently with {custody.current_holder_name}.</p>
          ) : null}
          {status === "checked_in" && custody?.current_holder_name ? (
            <p className="text-xs text-muted-foreground">Delivered by {custody.current_holder_name}.</p>
          ) : null}
          {status === "in_library" ? (
            <form action={scanAdvancePermitCustody}>
              <input type="hidden" name="jobId" value={job.id} />
              <input type="hidden" name="jobNumber" value={job.job_number} />
              <input type="hidden" name="returnTo" value={returnTo} />
              <Button type="submit" size="lg">Check out — take custody</Button>
            </form>
          ) : null}
          {status === "checked_out" ? (
            <form action={scanAdvancePermitCustody}>
              <input type="hidden" name="jobId" value={job.id} />
              <input type="hidden" name="jobNumber" value={job.job_number} />
              <input type="hidden" name="returnTo" value={returnTo} />
              <Button type="submit" size="lg">Check in — delivered to job site</Button>
            </form>
          ) : null}
        </CardContent>
      </Card>

      {isAssignedPm && !assignment?.pm_checked_at ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-heading text-base">You&apos;re the PM on this job</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={checkInstallJob}>
              <input type="hidden" name="jobId" value={job.id} />
              <input type="hidden" name="jobNumber" value={job.job_number} />
              <input type="hidden" name="next" value={returnTo} />
              <Button type="submit" size="lg">Check in</Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-wrap gap-2 pt-2">
        <Button asChild variant="outline">
          <Link href={`/warehouse?job=${encodeURIComponent(job.job_number)}`}>Open in Warehouse</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={`/sales?job=${encodeURIComponent(job.job_number)}`}>Open in Sales</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href={`/jobs/${job.id}`}>Full job details</Link>
        </Button>
      </div>
    </div>
  );
}
