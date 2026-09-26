import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { buildPermitChecklistPdf, computeWindowTotals, groupOpeningsByNoa } from "@/lib/permit-package/checklist-pdf";
import type { NoaLibraryRow } from "@/lib/noa/match";
import { loadNoaLibraryEffective } from "@/lib/noa/load";
import type { ScheduleWindowRow } from "@/lib/permit-package/schedule-pdf";

export const runtime = "nodejs";

const COUNTY_LABELS: Record<string, string> = {
  schedule: "Broward County",
  pbc: "Palm Beach County",
  miami: "Miami-Dade County",
  martin: "Martin County",
  boca: "Boca Raton",
  wellington: "Village of Wellington",
  irc: "Indian River County",
};

export async function POST(req: Request) {
  const url = new URL(req.url);
  const jobId = url.searchParams.get("jobId");
  if (!jobId) {
    return NextResponse.json({ error: "jobId is required" }, { status: 400 });
  }
  const supabase = await createServerClient();
  const [jobRes, planRes] = await Promise.all([
    supabase.from("jobs").select("*").eq("id", jobId).maybeSingle(),
    supabase.from("floor_plans").select("plan_data").eq("job_id", jobId).maybeSingle(),
  ]);
  if (jobRes.error || !jobRes.data) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }
  const job = jobRes.data;
  const library = (await loadNoaLibraryEffective(supabase)) as NoaLibraryRow[];
  const planData = (planRes.data?.plan_data ?? {}) as {
    windows?: ScheduleWindowRow[];
    scheduleJurisdiction?: string;
  };
  const windows: ScheduleWindowRow[] = planData.windows ?? [];
  const jurisdictionKey = planData.scheduleJurisdiction ?? "schedule";
  const countyLabel = COUNTY_LABELS[jurisdictionKey] ?? "Broward County";
  const { groups, unmatched } = groupOpeningsByNoa(windows, library);
  const { totalOpenings, totalSqFt } = computeWindowTotals(windows);

  const pdfBytes = await buildPermitChecklistPdf({
    jobNumber: job.job_number,
    clientName: job.client_name,
    address: job.address ?? "",
    countyLabel,
    fenestrationChartName: null,
    scheduleFileName: `${countyLabel} Window-Door Schedule.pdf`,
    noaGroups: groups,
    unmatchedOpeningCount: unmatched,
    totalOpenings,
    totalSqFt,
  });

  const body = new Uint8Array(pdfBytes.byteLength);
  body.set(pdfBytes);
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${job.job_number} Permit Checklist.pdf"`,
    },
  });
}
