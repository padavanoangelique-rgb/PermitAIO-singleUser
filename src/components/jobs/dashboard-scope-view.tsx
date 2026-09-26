"use client";

import { useMemo, useState } from "react";
import { Briefcase, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NewJobDialog } from "@/components/new-job-dialog";
import { JobsTable, type JobRow, type ViewerKind } from "@/components/jobs/jobs-table";
import { JobsKpiStrip, type JobsKpis, type JobsKpiFilter } from "@/components/jobs/jobs-kpi-strip";
import { AgingAlerts, type AgingJob } from "@/components/jobs/aging-alerts";
import {
  TeamStatusPanel,
  type TechBreakdownRow,
  type AmBreakdownRow,
  type TechFilter,
} from "@/components/jobs/team-status-panel";
import { FieldOverview, type FieldOverviewData } from "@/components/jobs/field-overview";

type ScopeData = { rows: JobRow[]; kpis: JobsKpis; agingJobs: AgingJob[] };

function isAging(row: JobRow): boolean {
  return !!row.agentTouched;
}

function filterRows(
  rows: JobRow[],
  key: JobsKpiFilter | null,
  tech: TechFilter,
  statusKind: "permit" | "hoa",
): JobRow[] {
  let next = rows;
  if (tech?.kind === "permit") next = next.filter((r) => r.permit_tech === tech.tech);
  if (tech?.kind === "hoa") next = next.filter((r) => (r.hoa_tech || r.hoa_assigned_to) === tech.tech);
  if (tech?.kind === "am") next = next.filter((r) => r.account_manager_id === tech.id);
  const kind: "permit" | "hoa" = tech?.kind === "hoa" || statusKind === "hoa" ? "hoa" : "permit";
  const statusOf = (r: JobRow) => (kind === "hoa" ? r.hoa_status : r.sub_status);
  switch (key) {
    case null:
    case "totalActive":
      return next;
    case "needToSubmit":
      return next.filter((r) => statusOf(r) === "Need to Submit");
    case "inReview":
      return next.filter((r) => statusOf(r) === "In Review");
    case "approved":
      return next.filter((r) => {
        const status = statusOf(r);
        return status === "Approved" || status === "Approved and Printed";
      });
    case "agingCount":
      return next.filter(isAging);
    default:
      return next;
  }
}

const FILTER_LABELS: Record<JobsKpiFilter, string> = {
  totalActive: "All active jobs",
  needToSubmit: "Need to submit",
  inReview: "In review",
  approved: "Approved / printed",
  agingCount: "Needs attention",
};

export function DashboardScopeView({
  data,
  allJobsCount,
  hasMyIdentity,
  canAssign,
  viewerKind,
  field,
  permitTechs,
  hoaTechs,
  accountManagers,
}: {
  data: ScopeData;
  allJobsCount: number;
  hasMyIdentity: boolean;
  canAssign: boolean;
  viewerKind: ViewerKind;
  field?: FieldOverviewData;
  permitTechs?: TechBreakdownRow[];
  hoaTechs?: TechBreakdownRow[];
  accountManagers?: AmBreakdownRow[];
}) {
  const [filter, setFilter] = useState<JobsKpiFilter | null>(null);
  const [tech, setTech] = useState<TechFilter>(null);
  const statusKind: "permit" | "hoa" =
    viewerKind === "hoa" || tech?.kind === "hoa" ? "hoa" : "permit";
  const filteredRows = useMemo(
    () => filterRows(data.rows, filter, tech, statusKind),
    [data.rows, filter, tech, statusKind],
  );
  const attentionJobs = useMemo(() => {
    if (!tech) return data.agingJobs;
    if (tech.kind === "permit") return data.agingJobs.filter((j) => j.permit_tech === tech.tech);
    if (tech.kind === "am") return data.agingJobs;
    return data.agingJobs.filter((j) => j.hoa_tech === tech.tech);
  }, [data.agingJobs, tech]);

  return (
    <div className="space-y-4">
      {canAssign && permitTechs && hoaTechs ? (
        <TeamStatusPanel
          permitTechs={permitTechs}
          hoaTechs={hoaTechs}
          accountManagers={accountManagers}
          selected={tech}
          onSelect={setTech}
        />
      ) : null}

      {canAssign && field ? <FieldOverview field={field} /> : null}

      <JobsKpiStrip kpis={data.kpis} activeFilter={filter} onFilterChange={setFilter} />

      {(filter && filter !== "totalActive") || tech ? (
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground print:hidden">
          <span>
            {tech ? (
              <>
                Showing{" "}
                {tech.kind === "permit"
                  ? "permit tech"
                  : tech.kind === "hoa"
                    ? "HOA tech"
                    : "account manager"}{" "}
                <span className="font-medium text-foreground">
                  {tech.kind === "am" ? tech.name : tech.tech}
                </span>
              </>
            ) : null}
            {filter && filter !== "totalActive" ? (
              <>
                {tech ? " · " : null}
                <span className="font-medium text-foreground">{FILTER_LABELS[filter]}</span>
              </>
            ) : null}{" "}
            — {filteredRows.length} of {data.rows.length}
          </span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-11 gap-1"
            onClick={() => {
              setFilter(null);
              setTech(null);
            }}
          >
            <X className="h-3.5 w-3.5" />
            Clear filter
          </Button>
        </div>
      ) : null}

      <AgingAlerts jobs={attentionJobs} />

      {filteredRows.length > 0 ? (
        <JobsTable jobs={filteredRows} canAssign={canAssign} />
      ) : (
        <Card className="print:hidden">
          <CardContent className="flex flex-col gap-3 py-16 text-center items-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Briefcase className="h-6 w-6" />
            </div>
            <div>
              {tech || (filter && filter !== "totalActive") ? (
                <>
                  <p className="font-medium">No jobs match this filter</p>
                  <p className="text-sm text-muted-foreground">Clear the filter to see the full queue.</p>
                </>
              ) : viewerKind === "manager" ? (
                <>
                  <p className="font-medium">{allJobsCount > 0 ? "No active jobs" : "No jobs yet"}</p>
                  <p className="text-sm text-muted-foreground">
                    {allJobsCount > 0
                      ? "Every job in this organization is marked Complete."
                      : "Create your first job to start tracking floor plans, permits, and HOA approvals together."}
                  </p>
                </>
              ) : viewerKind === "member" || !hasMyIdentity ? (
                <>
                  <p className="font-medium">Set your tech identity</p>
                  <p className="text-sm text-muted-foreground">
                    Pick which Permit Tech / HOA Tech you are in Settings to see just your jobs here.
                  </p>
                </>
              ) : (
                <>
                  <p className="font-medium">No jobs assigned to you</p>
                  <p className="text-sm text-muted-foreground">
                    Nothing in the active queue is assigned to you right now.
                  </p>
                </>
              )}
            </div>
            {viewerKind === "manager" && !filter && !tech && <NewJobDialog />}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
