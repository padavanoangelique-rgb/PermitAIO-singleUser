import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { fillBocaOfficialSchedule } from "@/lib/permit-package/boca-schedule-pdf";
import type { ScheduleWindowRow } from "@/lib/permit-package/schedule-pdf";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    jobId?: string;
    openings?: ScheduleWindowRow[];
    address?: string;
    permitNumber?: string;
  };
  const supabase = await createServerClient();
  let openings = body.openings ?? [];
  let address = body.address ?? "";
  let permitNumber = body.permitNumber ?? "";
  if (body.jobId) {
    const [jobRes, planRes] = await Promise.all([
      supabase.from("jobs").select("address, city, permit_number").eq("id", body.jobId).maybeSingle(),
      supabase.from("floor_plans").select("plan_data").eq("job_id", body.jobId).maybeSingle(),
    ]);
    if (jobRes.data) {
      address = address || [jobRes.data.address, jobRes.data.city].filter(Boolean).join(", ");
      permitNumber = permitNumber || jobRes.data.permit_number || "";
    }
    const plan = (planRes.data?.plan_data ?? {}) as { windows?: ScheduleWindowRow[] };
    if (!openings.length) openings = plan.windows ?? [];
  }
  const origin = new URL(req.url).origin;
  const templateRes = await fetch(`${origin}/templates/boca-window-door-schedule.pdf`, { cache: "force-cache" });
  if (!templateRes.ok) {
    return NextResponse.json(
      { error: "Official Boca Raton schedule template is not on the server yet." },
      { status: 503 },
    );
  }
  const filled = await fillBocaOfficialSchedule(new Uint8Array(await templateRes.arrayBuffer()), openings, {
    address,
    permitNumber,
  });
  const out = new Uint8Array(filled.byteLength);
  out.set(filled);
  return new Response(out, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="Boca-Raton-Window-Door-Schedule.pdf"',
    },
  });
}
