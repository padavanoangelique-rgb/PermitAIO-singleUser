import { HOMEOWNER_STAGES, type FriendlyStage } from "@/lib/sales/friendly-status";
import { requestStatusUpdate } from "@/lib/sales/status-actions";
import { StatusTimeline } from "@/components/sales/status-card";

export type StatusPayload = {
  jobNumber: string;
  clientName: string;
  address: string;
  permitNumber: string | null;
  permitTitle: string;
  permitDescription: string;
  permitNext: string;
  stageIndex: number;
  hoaStageIndex: number;
  permitAssigned: string | null;
  permitSubmitted: string | null;
  permitApproved: string | null;
  permitTech: string;
  hoaTitle: string;
  hoaDetail: string;
  hoaAssigned: string | null;
  hoaSubmitted: string | null;
  hoaApproved: string | null;
  hoaTech: string;
  orderedDate: string | null;
  materialEta: string | null;
  permitEta: string;
  hoaEta: string;
  contractorName: string;
  contractorLogo: string | null;
  contractorPhone: string | null;
  contractorEmail: string | null;
};

function RequestUpdateButton({
  jobId,
  jobNumber,
  requesterRole,
  returnTo,
}: {
  jobId: string;
  jobNumber: string;
  requesterRole: string;
  returnTo: string;
}) {
  return (
    <form action={requestStatusUpdate} className="flex items-center gap-1.5">
      <input type="hidden" name="jobId" value={jobId} />
      <input type="hidden" name="jobNumber" value={jobNumber} />
      <input type="hidden" name="requesterRole" value={requesterRole} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <select
        name="target"
        defaultValue="permit"
        className="h-11 rounded-full border border-input bg-background px-3 text-xs text-foreground"
      >
        <option value="permit">Ask permit tech</option>
        <option value="hoa">Ask HOA tech</option>
      </select>
      <button
        type="submit"
        className="min-h-11 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
      >
        Request update
      </button>
    </form>
  );
}

export function StatusView({
  data,
  audience,
  jobId,
  requesterRole,
  returnTo,
}: {
  data: StatusPayload;
  audience: "sales" | "homeowner";
  jobId?: string;
  requesterRole?: string;
  returnTo?: string;
}) {
  const stage: FriendlyStage = HOMEOWNER_STAGES[data.stageIndex] ?? HOMEOWNER_STAGES[0];

  return (
    <div className="space-y-4">
      <header className={audience === "homeowner" ? "text-center" : "flex flex-wrap items-start justify-between gap-3"}>
        <div>
          {audience === "homeowner" ? (
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Project status</p>
          ) : (
            <p className="font-mono text-xs text-muted-foreground">{data.jobNumber}</p>
          )}
          <h1 className="mt-2 font-heading text-3xl tracking-tight">
            {audience === "homeowner" ? data.address || data.clientName : data.clientName}
          </h1>
          {audience === "homeowner" ? (
            <p className="mt-1 text-sm text-muted-foreground">{data.clientName}</p>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">{data.address || "No address"}</p>
          )}
        </div>
        {audience === "sales" && jobId ? (
          <RequestUpdateButton
            jobId={jobId}
            jobNumber={data.jobNumber}
            requesterRole={requesterRole ?? "Team"}
            returnTo={returnTo ?? "/sales"}
          />
        ) : null}
      </header>

      <StatusTimeline
        data={{
          permitTitle: data.permitTitle || stage.title,
          permitEta: data.permitEta,
          stageIndex: data.stageIndex,
          permitAssigned: data.permitAssigned,
          permitSubmitted: data.permitSubmitted,
          permitApproved: data.permitApproved,
          permitNumber: data.permitNumber,
          permitTech: data.permitTech,
          hoaTitle: data.hoaTitle,
          hoaEta: data.hoaEta,
          hoaStageIndex: data.hoaStageIndex,
          hoaAssigned: data.hoaAssigned,
          hoaSubmitted: data.hoaSubmitted,
          hoaApproved: data.hoaApproved,
          hoaTech: data.hoaTech,
          orderedDate: data.orderedDate,
          materialEta: data.materialEta,
        }}
        showTechs={audience === "sales"}
      />

      {audience === "homeowner" && (data.contractorPhone || data.contractorEmail) ? (
        <section className="rounded-2xl border bg-card p-6 text-center">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Questions?</p>
          <p className="mt-1 font-heading text-lg">{data.contractorName}</p>
          {data.contractorPhone ? <p className="mt-1 text-sm">{data.contractorPhone}</p> : null}
          {data.contractorEmail ? (
            <p className="mt-1 text-sm">
              <a className="text-primary underline-offset-2 hover:underline" href={`mailto:${data.contractorEmail}`}>
                {data.contractorEmail}
              </a>
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
