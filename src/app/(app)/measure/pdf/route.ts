import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser, requireActiveOrg } from "@/lib/data/orgs";
import { buildMeasureFieldPacketPdf } from "@/lib/measure/field-packet-pdf";

export async function GET(request: Request) {
  await requireUser();
  const { activeOrg } = await requireActiveOrg();
  const jobId = new URL(request.url).searchParams.get("jobId") ?? "";
  if (!jobId) return new NextResponse("Missing job", { status: 400 });

  const supabase = await createClient();
  const { data: job } = await supabase
    .from("jobs")
    .select("id, job_number, client_name, address, city")
    .eq("org_id", activeOrg.id)
    .eq("id", jobId)
    .maybeSingle();
  if (!job) return new NextResponse("Job not found", { status: 404 });

  const { data: rows } = await supabase
    .from("job_files")
    .select("file_name, storage_path")
    .eq("org_id", activeOrg.id)
    .eq("job_id", jobId)
    .eq("category", "measure")
    .order("uploaded_at", { ascending: true });

  const files: { bytes: Uint8Array; name: string }[] = [];
  for (const row of rows ?? []) {
    const { data, error } = await supabase.storage.from("job-files").download(row.storage_path);
    if (error || !data) continue;
    files.push({ bytes: new Uint8Array(await data.arrayBuffer()), name: row.file_name });
  }

  const bytes = await buildMeasureFieldPacketPdf({
    jobNumber: job.job_number,
    clientName: job.client_name,
    address: [job.address, job.city].filter(Boolean).join(", "),
    files,
  });

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${job.job_number}-measure-packet.pdf"`,
    },
  });
}
