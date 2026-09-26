import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
// Miami-Dade uses the same BORA Policy 20-01 County Uniform Retrofit form (same field names).
import { fillPbcOfficialSchedule } from "@/lib/permit-package/pbc-schedule-pdf";
import type { ScheduleWindowRow } from "@/lib/permit-package/schedule-pdf";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    jobId?: string;
    openings?: ScheduleWindowRow[];
    address?: string;
    applicant?: string;
  };
  const supabase = await createServerClient();
  let openings = body.openings ?? [];
  let address = body.address ?? "";
  let applicant = body.applicant ?? "";
  if (body.jobId) {
    const [jobRes, planRes] = await Promise.all([
      supabase.from("jobs").select("client_name, address, city").eq("id", body.jobId).maybeSingle(),
      supabase.from("floor_plans").select("plan_data").eq("job_id", body.jobId).maybeSingle(),
    ]);
    if (jobRes.data) {
      address = address || [jobRes.data.address, jobRes.data.city].filter(Boolean).join(", ");
      applicant = applicant || jobRes.data.client_name || "";
    }
    const plan = (planRes.data?.plan_data ?? {}) as { windows?: ScheduleWindowRow[] };
    if (!openings.length) openings = plan.windows ?? [];
  }
  const origin = new URL(req.url).origin;
  const templateRes = await fetch(`${origin}/templates/miami-dade-window-door-schedule.pdf`, { cache: "force-cache" });
  if (!templateRes.ok) {
    return NextResponse.json(
      { error: "Official Miami-Dade schedule template is not on the server yet." },
      { status: 503 },
    );
  }
  const filled = await fillPbcOfficialSchedule(new Uint8Array(await templateRes.arrayBuffer()), openings, {
    applicant,
    address,
  });
  return new NextResponse(Buffer.from(filled), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": 'attachment; filename="Miami-Dade-County-Window-Door-Schedule.pdf"',
    },
  });
}
