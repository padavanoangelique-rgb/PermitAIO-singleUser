import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser, requireActiveOrg } from "@/lib/data/orgs";
import { ensureJobScanToken, scanUrlForToken } from "@/lib/jobs/scan-token";
import { buildJobStickerPdf } from "@/lib/jobs/sticker-pdf";

/**
 * One sticker design, reused for every reason someone needs to print a
 * job's QR: permit custody, or just labeling a warehouse pull with which
 * job it belongs to. /warehouse and the permit views both link here.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { activeOrg } = await requireActiveOrg();
  const { id: jobId } = await params;

  const supabase = await createClient();
  const { data: job } = await supabase
    .from("jobs")
    .select("id, job_number, client_name, address, city")
    .eq("org_id", activeOrg.id)
    .eq("id", jobId)
    .maybeSingle();
  if (!job) {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }

  const token = await ensureJobScanToken(job.id, activeOrg.id);
  const scanUrl = scanUrlForToken(token);
  const pdfBytes = await buildJobStickerPdf({
    jobNumber: job.job_number,
    clientName: job.client_name,
    address: [job.address, job.city].filter(Boolean).join(", "),
    scanUrl,
  });

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${job.job_number}-sticker.pdf"`,
    },
  });
}
