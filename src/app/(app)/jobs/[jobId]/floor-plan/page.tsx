import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireActiveOrg, requireUser } from "@/lib/data/orgs";
import { isPlatformAdmin } from "@/lib/data/platform-admin";
import { FloorPlanEmbed } from "@/components/jobs/floor-plan-embed";

/**
 * Floor plan editor rendered inside the (app) sidebar/header shell. The
 * "Back to Job" pill lives in the shared app header (see HeaderBackToJob)
 * so this page has no duplicate sub-header — the iframe takes the full
 * content area, matching every other tab visually.
 *
 * The parent <main> pads with p-6, which we cancel here with negative
 * margins so the tool fills the available space.
 */
export default async function JobFloorPlanPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  await requireUser();
  const { activeOrg } = await requireActiveOrg();
  const supabase = await createClient();

  const { data: job } = await supabase
    .from("jobs")
    .select("id, org_id")
    .eq("id", jobId)
    .eq("org_id", activeOrg.id)
    .maybeSingle();

  if (!job) notFound();

  const isAdmin = await isPlatformAdmin();

  return (
    <div className="-m-6 flex h-[calc(100vh-3.5rem)] min-h-0 w-[calc(100%+3rem)] flex-col">
      <FloorPlanEmbed orgId={job.org_id} jobId={job.id} isPlatformAdmin={isAdmin} />
    </div>
  );
}
