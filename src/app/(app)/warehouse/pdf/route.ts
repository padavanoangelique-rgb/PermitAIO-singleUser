import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser, requireActiveOrg } from "@/lib/data/orgs";
import { openingsForJob } from "@/lib/warehouse/openings";
import { permitIsApproved } from "@/lib/warehouse/permit";
import { buildWarehouseChecklistPdf } from "@/lib/warehouse/checklist-pdf";

export async function GET(request: Request) {
  await requireUser();
  const { activeOrg } = await requireActiveOrg();
  const jobId = new URL(request.url).searchParams.get("jobId") ?? "";
  if (!jobId) return new NextResponse("Missing job", { status: 400 });

  const supabase = await createClient();
  const { data: job } = await supabase
    .from("jobs")
    .select("id, job_number, client_name, address, permit_number, sub_status")
    .eq("org_id", activeOrg.id)
    .eq("id", jobId)
    .maybeSingle();
  if (!job) return new NextResponse("Job not found", { status: 404 });

  const { data: plan } = await supabase
    .from("floor_plans")
    .select("plan_data")
    .eq("org_id", activeOrg.id)
    .eq("job_id", jobId)
    .maybeSingle();

  let checkins: { opening_key: string; received_at: string | null; broken: boolean; note: string | null }[] = [];
  let manualWindows = 0;
  let manualDoors = 0;
  try {
    const db = supabase as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (a: string, b: string) => { eq: (c: string, d: string) => Promise<{ data: unknown[] | null }> };
        };
      };
    };
    const { data } = await db
      .from("warehouse_checkins")
      .select("opening_key, received_at, broken, note")
      .eq("org_id", activeOrg.id)
      .eq("job_id", jobId);
    checkins = (data ?? []) as typeof checkins;
    const counts = await db
      .from("warehouse_jobs")
      .select("manual_windows, manual_doors")
      .eq("org_id", activeOrg.id)
      .eq("job_id", jobId);
    const row = (counts.data ?? [])[0] as { manual_windows?: number | null; manual_doors?: number | null } | undefined;
    manualWindows = row?.manual_windows ?? 0;
    manualDoors = row?.manual_doors ?? 0;
  } catch {
    checkins = [];
  }

  const byKey = new Map(checkins.map((c) => [c.opening_key, c]));
  const openings = openingsForJob(plan?.plan_data, manualWindows, manualDoors).map((o) => {
    const row = byKey.get(o.key);
    return {
      ...o,
      received: !!row?.received_at,
      broken: !!row?.broken,
      note: row?.note ?? "",
    };
  });

  const bytes = await buildWarehouseChecklistPdf({
    jobNumber: job.job_number,
    clientName: job.client_name,
    address: job.address ?? "",
    permitNumber: job.permit_number ?? "",
    permitApproved: permitIsApproved(job.sub_status),
    permitStatus: job.sub_status ?? "",
    openings,
  });

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${job.job_number}-warehouse-checklist.pdf"`,
    },
  });
}
