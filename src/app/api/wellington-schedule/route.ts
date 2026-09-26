import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { fillWellingtonOfficialWorksheet, type WellingtonOpening } from "@/lib/permit-package/wellington-schedule-pdf";

export const runtime = "nodejs";

function empty(v: unknown) {
  return v === null || v === undefined || v === "";
}

function mergeOpening(fromBody: WellingtonOpening, fromPlan?: WellingtonOpening): WellingtonOpening {
  const saved = fromPlan || {};
  return {
    ...saved,
    ...fromBody,
    pressurePos: empty(fromBody.pressurePos) ? saved.pressurePos : fromBody.pressurePos,
    pressureNeg: empty(fromBody.pressureNeg) ? saved.pressureNeg : fromBody.pressureNeg,
    productApproval: empty(fromBody.productApproval) ? saved.productApproval : fromBody.productApproval,
    designPos: empty(fromBody.designPos) ? saved.designPos : fromBody.designPos,
    designNeg: empty(fromBody.designNeg) ? saved.designNeg : fromBody.designNeg,
    zone: empty(fromBody.zone) ? saved.zone : fromBody.zone,
    manufacturer: empty(fromBody.manufacturer) ? saved.manufacturer : fromBody.manufacturer,
    series: empty(fromBody.series) ? saved.series : fromBody.series,
  };
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    jobId?: string;
    openings?: WellingtonOpening[];
    address?: string;
    clientName?: string;
    qualifierName?: string;
    roofHeightFt?: number;
  };
  const supabase = await createServerClient();
  let openings: WellingtonOpening[] = body.openings ?? [];
  let address = body.address ?? "";
  let clientName = body.clientName ?? "";
  let qualifierName = body.qualifierName ?? "";
  if (body.jobId) {
    const [jobRes, planRes, contractorRes] = await Promise.all([
      supabase.from("jobs").select("client_name, address, city").eq("id", body.jobId).maybeSingle(),
      supabase.from("floor_plans").select("plan_data").eq("job_id", body.jobId).maybeSingle(),
      supabase.from("contractor_profiles").select("qualifier_name").limit(1),
    ]);
    if (jobRes.data) {
      clientName = clientName || jobRes.data.client_name || "";
      address = address || [jobRes.data.address, jobRes.data.city].filter(Boolean).join(", ");
    }
    const plan = (planRes.data?.plan_data ?? {}) as { windows?: WellingtonOpening[] };
    const saved = plan.windows ?? [];
    if (openings.length) {
      openings = openings.map((o, i) => mergeOpening(o, saved[i]));
    } else {
      openings = saved;
    }
    qualifierName = qualifierName || contractorRes.data?.[0]?.qualifier_name || "";
  }
  const origin = new URL(req.url).origin;
  const templateRes = await fetch(`${origin}/templates/wellington-window-door-worksheet.pdf`, { cache: "force-cache" });
  if (!templateRes.ok) {
    return NextResponse.json(
      { error: "Official Wellington worksheet template is not on the server yet." },
      { status: 503 },
    );
  }
  const templateBytes = new Uint8Array(await templateRes.arrayBuffer());
  const filled = await fillWellingtonOfficialWorksheet(templateBytes, openings, {
    address,
    clientName,
    qualifierName,
    roofHeightFt: body.roofHeightFt,
  });
  const out = new Uint8Array(filled.byteLength);
  out.set(filled);
  return new Response(out, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="Wellington-Window-Door-Worksheet.pdf"',
    },
  });
}
