"use client";

import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import type { Tables } from "@/lib/supabase/types";
import { SUB_STATUSES, currency, daysBetween, isFlagged } from "@/lib/inventory/constants";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Job = Tables<"jobs">;

export function BoardView({ jobs, onOpen }: { jobs: Job[]; onOpen: (job: Job) => void }) {
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="flex gap-4 overflow-x-auto pb-3">
      {SUB_STATUSES.map((status) => {
        const statusJobs = jobs.filter((job) => job.sub_status === status);
        const value = statusJobs.reduce((sum, job) => sum + (job.contract_value ?? 0), 0);
        return (
          <section key={status} className="w-72 shrink-0 space-y-2">
            <Card className="gap-1 py-3">
              <CardHeader className="flex-row items-center justify-between px-4 py-0">
                <CardTitle className="text-sm">{status}</CardTitle>
                <Badge variant="secondary">{statusJobs.length}</Badge>
              </CardHeader>
              <CardContent className="px-4 text-xs text-muted-foreground">{currency(value)}</CardContent>
            </Card>
            <div className="space-y-2">
              {statusJobs.map((job) => {
                const waiting = job.sub_status === "In Review"
                  ? daysBetween(job.submitted_date, today)
                  : job.sub_status === "Need to Submit"
                    ? daysBetween(job.assigned_date, today)
                    : null;
                return (
                  <div
                    key={job.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onOpen(job)}
                    onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onOpen(job); } }}
                    className={`w-full cursor-pointer rounded-xl border bg-card p-3 text-left shadow-sm transition-colors hover:border-primary ${isFlagged(job) ? "border-destructive/60" : ""}`}
                  >
                    <p className="font-medium">
                      {isFlagged(job) && <TriangleAlert className="mr-1 inline h-4 w-4 text-destructive" />}
                      {job.client_name}
                    </p>
                    <p className="text-xs text-muted-foreground">#<Link href={`/jobs/${job.id}`} onClick={(event) => event.stopPropagation()} className="font-medium text-primary hover:underline">{job.job_number}</Link>{job.trade_type ? ` · ${job.trade_type}` : ""}</p>
                    {job.jurisdiction && <p className="mt-0.5 text-xs text-muted-foreground">{job.jurisdiction}</p>}
                    <div className="mt-2 flex items-center justify-between gap-2">
                      {waiting !== null ? <Badge variant="outline" className="text-[10px]">{waiting}d waiting</Badge> : <span />}
                      {job.contract_value != null && <span className="text-sm font-medium text-primary">{currency(job.contract_value)}</span>}
                    </div>
                  </div>
                );
              })}
              {statusJobs.length === 0 && <Card className="py-6 text-center text-xs text-muted-foreground">No jobs</Card>}
            </div>
          </section>
        );
      })}
    </div>
  );
}
