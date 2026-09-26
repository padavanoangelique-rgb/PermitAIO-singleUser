import { createClient } from "@/lib/supabase/server";
import { requireUser, requireActiveOrg } from "@/lib/data/orgs";
import { lookupJobStatus } from "@/lib/sales/lookup";
import { StatusView } from "@/components/sales/status-view";
import { FIELD, LOOKUP, TAP_BLUE } from "@/lib/ui/chrome";

export default async function InstallStatusPage({
  searchParams,
}: {
  searchParams: Promise<{ job?: string; mail?: string }>;
}) {
  const user = await requireUser();
  const { activeOrg } = await requireActiveOrg();
  const supabase = await createClient();
  const params = await searchParams;
  const lookup = (params.job ?? "").trim();

  const { notFound, status, jobId, tableNote } = await lookupJobStatus(supabase, activeOrg.id, lookup);

  const db = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => { eq: (a: string, b: string) => Promise<{ data: { role: string; email: string; user_id: string | null }[] | null }> };
    };
  };
  const { data: myRosterRows } = await db.from("install_members").select("role, email, user_id").eq("org_id", activeOrg.id);
  const myEmail = (user.email ?? "").toLowerCase();
  const myRoles = (myRosterRows ?? []).filter((m) => m.email.toLowerCase() === myEmail || m.user_id === user.id);
  const isAccountManagerOnly =
    myRoles.length > 0 && myRoles.every((m) => m.role === "account_manager");
  const requesterRole = isAccountManagerOnly ? "Account manager" : "Install manager";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Install</p>
        <h1 className="mt-1 font-heading text-2xl font-semibold tracking-tight">Permit & HOA status</h1>
        <p className="text-sm text-muted-foreground">
          Type a job number to see where its permit and HOA stand — same view Sales uses.
        </p>
      </div>

      {params.mail ? <p className="text-sm text-emerald-700">{params.mail}</p> : null}
      {tableNote ? <p className="text-sm text-amber-700">{tableNote}</p> : null}

      <form method="get" action="/install/status" className={LOOKUP}>
        <label className="text-sm font-medium">
          Job number
          <input
            name="job"
            defaultValue={lookup}
            autoFocus
            autoComplete="off"
            placeholder="92300-1"
            className={`${FIELD} min-w-[220px] font-mono text-base`}
          />
        </label>
        <button className={TAP_BLUE} type="submit">
          Pull job
        </button>
        {status ? (
          <a href="/install/status" className="inline-flex min-h-11 items-center text-sm text-muted-foreground underline-offset-2 hover:underline">
            Clear
          </a>
        ) : null}
      </form>

      {notFound ? <p className="text-sm text-amber-700">No job matches “{lookup}”.</p> : null}
      {!status && !notFound ? (
        <p className="text-sm text-muted-foreground">Nothing on this screen until a job number is pulled.</p>
      ) : null}

      {status && jobId ? (
        <StatusView data={status} audience="sales" jobId={jobId} requesterRole={requesterRole} returnTo="/install/status" />
      ) : null}
    </div>
  );
}
