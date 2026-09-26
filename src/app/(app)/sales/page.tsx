import { createClient } from "@/lib/supabase/server";
import { requireUser, requireActiveOrg } from "@/lib/data/orgs";
import { lookupJobStatus } from "@/lib/sales/lookup";
import { SalesBoard, type SalesFile, type SalesNote } from "./sales-board";

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ job?: string; mail?: string }>;
}) {
  await requireUser();
  const { activeOrg } = await requireActiveOrg();
  const supabase = await createClient();
  const params = await searchParams;
  const lookup = (params.job ?? "").trim();

  const { notFound, status, jobId, trackUrl, tableNote } = await lookupJobStatus(supabase, activeOrg.id, lookup);

  let files: SalesFile[] = [];
  let notes: SalesNote[] = [];
  if (jobId) {
    const { data: fileRows } = await supabase
      .from("job_files")
      .select("id, file_name, storage_path, uploaded_at")
      .eq("org_id", activeOrg.id)
      .eq("job_id", jobId)
      .order("uploaded_at", { ascending: false });
    files = (fileRows ?? []) as SalesFile[];
    const { data: noteRows } = await supabase
      .from("job_activity")
      .select("id, message, created_at")
      .eq("org_id", activeOrg.id)
      .eq("job_id", jobId)
      .eq("activity_type", "note")
      .order("created_at", { ascending: false })
      .limit(20);
    notes = (noteRows ?? []) as SalesNote[];
  }

  return (
    <SalesBoard
      lookup={lookup}
      notFound={notFound}
      mail={params.mail}
      tableNote={tableNote}
      status={status}
      jobId={jobId}
      orgId={activeOrg.id}
      trackUrl={trackUrl}
      files={files}
      notes={notes}
    />
  );
}
