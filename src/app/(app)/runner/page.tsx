import { createClient } from "@/lib/supabase/server";
import { requireUser, requireActiveOrg } from "@/lib/data/orgs";
import { RunnerDashboard, type RunnerJob, type RunnerMember, type RunnerRun } from "./runner-dashboard";
import { RunnerApp } from "./runner-app";

export default async function RunnerPage({
  searchParams,
}: {
  searchParams: Promise<{ mail?: string }>;
}) {
  const user = await requireUser();
  const { activeOrg } = await requireActiveOrg();
  const params = await searchParams;
  const supabase = await createClient();

  const db = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => { eq: (a: string, b: string) => Promise<{ data: unknown[] | null; error: { message: string } | null }> };
    };
  };

  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, job_number, client_name, address, city, jurisdiction")
    .eq("org_id", activeOrg.id)
    .order("created_at", { ascending: false });

  let roster: RunnerMember[] = [];
  let runs: RunnerRun[] = [];
  let tableNote = "";
  try {
    const rosterRes = await db.from("runner_members").select("id, email, user_id, display_name").eq("org_id", activeOrg.id);
    const runsRes = await db
      .from("runner_jobs")
      .select("id, job_id, job_number, place, note, runner_id, assigned_by_email, checked_in_at, checked_out_at, created_at")
      .eq("org_id", activeOrg.id);
    if (rosterRes.error || runsRes.error) {
      tableNote = (rosterRes.error ?? runsRes.error)?.message ?? "";
    } else {
      roster = (rosterRes.data ?? []) as RunnerMember[];
      runs = ((runsRes.data ?? []) as RunnerRun[]).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    }
  } catch (err) {
    tableNote = err instanceof Error ? err.message : "Runner tables not ready.";
  }

  const myEmail = (user.email ?? "").toLowerCase();
  const myRunner = roster.find((m) => m.email.toLowerCase() === myEmail || m.user_id === user.id);

  const catalog = (jobs ?? []) as RunnerJob[];

  if (myRunner) {
    const myRuns = runs.filter((r) => r.runner_id === myRunner.id);
    return <RunnerApp runs={myRuns} runnerName={myRunner.display_name || user.email || "Runner"} mail={params.mail} />;
  }

  return (
    <RunnerDashboard
      jobs={catalog}
      roster={roster}
      runs={runs}
      mail={params.mail}
      tableNote={tableNote}
      orgName={activeOrg.name}
    />
  );
}
