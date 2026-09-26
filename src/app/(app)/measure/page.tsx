import { requireActiveOrg, requireUser } from "@/lib/data/orgs";
import { listMeasureFiles, lookupMeasureJob } from "./actions";
import { MeasureBoard } from "./measure-board";

export default async function MeasurePage({
  searchParams,
}: {
  searchParams: Promise<{ job?: string; mode?: string }>;
}) {
  await requireUser();
  const { activeOrg } = await requireActiveOrg();
  const params = await searchParams;
  const lookup = (params.job ?? "").trim();
  const mode = (params.mode ?? "").trim();
  const result = lookup ? await lookupMeasureJob(lookup) : null;
  const notFound = Boolean(lookup && result && !result.found);
  const files = result?.found && result.jobId ? await listMeasureFiles(result.jobId) : [];

  return (
    <MeasureBoard
      lookup={lookup}
      notFound={notFound}
      mode={mode}
      orgId={activeOrg.id}
      files={files}
      job={
        result?.found
          ? {
              jobId: result.jobId ?? "",
              jobNumber: result.jobNumber,
              clientName: result.clientName ?? "",
              address: result.address,
              plan: result.plan,
            }
          : null
      }
    />
  );
}
