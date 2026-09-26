import { createClient } from "@/lib/supabase/server";
import { requireActiveOrg } from "@/lib/data/orgs";
import { Ruler } from "lucide-react";
import { isRoofingTrade } from "@/lib/jobs/trade";
import { FloorPlansView, type FloorPlanRow } from "./floor-plans-view";

export default async function FloorPlansPage() {
  const { activeOrg } = await requireActiveOrg();
  const supabase = await createClient();

  const { data: allJobs } = await supabase
    .from("jobs")
    .select("id, job_number, client_name, trade_type, address, stage, sub_status, submitted_date, permit_tech, hoa_tech")
    .eq("org_id", activeOrg.id)
    .order("created_at", { ascending: false });

  // Roofing jobs use the Roofing Details tab instead of a floor plan.
  const windowJobs = (allJobs ?? []).filter((j) => !isRoofingTrade(j.trade_type));

  const jobIds = windowJobs.map((j) => j.id);

  // Pull HOA tech from hoa_jobs (assigned_to) so the HOA tabs on this page
  // stay in sync with who's assigned in the HOA Tracker.
  const { data: hoaRows } = jobIds.length
    ? await supabase
        .from("hoa_jobs")
        .select("job_id, assigned_to")
        .in("job_id", jobIds)
    : { data: [] as { job_id: string; assigned_to: string | null }[] };

  const hoaByJob = new Map<string, string | null>();
  for (const row of hoaRows ?? []) {
    if (!row.job_id) continue;
    hoaByJob.set(row.job_id, row.assigned_to ?? null);
  }

  const { data: plans } = await supabase
    .from("floor_plans")
    .select("job_id, version, updated_at")
    .eq("org_id", activeOrg.id)
    .order("updated_at", { ascending: false });

  const latestPlanByJob = new Map<
    string,
    { version: number; updated_at: string }
  >();
  for (const plan of plans ?? []) {
    if (!plan.job_id || latestPlanByJob.has(plan.job_id)) continue;
    latestPlanByJob.set(plan.job_id, {
      version: plan.version,
      updated_at: plan.updated_at,
    });
  }

  const rows: FloorPlanRow[] = windowJobs.map((job) => {
    const plan = latestPlanByJob.get(job.id);
    const sub = (job.sub_status ?? "").trim().toLowerCase();
    const notFiled =
      !sub ||
      sub === "need to submit" ||
      sub === "quote needed" ||
      sub === "engineering pending";
    return {
      id: job.id,
      job_number: job.job_number,
      client_name: job.client_name,
      trade_type: job.trade_type,
      address: job.address,
      permit_tech: job.permit_tech ?? null,
      hoa_tech: job.hoa_tech || hoaByJob.get(job.id) || null,
      plan_version: plan?.version ?? null,
      plan_updated_at: plan?.updated_at ?? null,
      submitted: Boolean(job.submitted_date) || !notFiled,
    };
  });

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Permit tools</p>
        <h1 className="mt-1 font-heading text-2xl font-semibold tracking-tight">Permit Builder</h1>
        <p className="text-sm text-muted-foreground">
          Permit techs and HOA techs share these tools. One floor plan per job — do not draw it twice.
        </p>
      </div>

      {rows.length > 0 ? (
        <FloorPlansView jobs={rows} />
      ) : (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Ruler className="h-6 w-6" />
            </div>
            <div>
              <p className="font-medium">No jobs yet</p>
              <p className="text-sm text-muted-foreground">
                Create a job first, then open Permit Builder to start drawing.
              </p>
            </div>
          </div>
      )}
    </div>
  );
}
