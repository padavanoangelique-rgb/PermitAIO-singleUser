"use client";

import Link from "next/link";
import type { Tables } from "@/lib/supabase/types";
import { currency, daysBetween } from "@/lib/inventory/constants";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Job = Tables<"jobs">;

export function AgingView({ jobs, onOpen }: { jobs: Job[]; onOpen: (job: Job) => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const inReview = jobs
    .filter((job) => job.submitted_date && !job.approved_date)
    .map((job) => ({ job, days: daysBetween(job.submitted_date, today) ?? 0 }))
    .sort((a, b) => b.days - a.days);
  const buckets = [
    { label: "Under 15 days", match: (days: number) => days < 15, tone: "text-chart-3", border: "border-chart-3/40" },
    { label: "15–29 days", match: (days: number) => days >= 15 && days < 30, tone: "text-chart-2", border: "border-chart-2/40" },
    { label: "30–44 days", match: (days: number) => days >= 30 && days < 45, tone: "text-destructive", border: "border-destructive/40" },
    { label: "45+ days", match: (days: number) => days >= 45, tone: "text-destructive", border: "border-destructive/60" },
  ];
  const overdue = inReview.filter((record) => record.days >= 15);
  const overdueValue = overdue.reduce((sum, record) => sum + (record.job.contract_value ?? 0), 0);

  return (
    <div>
      <Card className="mb-4 gap-1 py-4">
        <CardContent className="px-4">
          <p className="text-sm"><span className="font-semibold text-destructive">{overdue.length}</span> permit{overdue.length === 1 ? "" : "s"} in review 15+ days, holding <span className="font-semibold text-primary">{currency(overdueValue)}</span>.</p>
          <p className="mt-1 text-xs text-muted-foreground">{inReview.length} total in review · longest waiting {inReview.length > 0 ? `${inReview[0].days} days` : "—"}</p>
        </CardContent>
      </Card>
      <div className="flex gap-4 overflow-x-auto pb-3">
        {buckets.map((bucket) => {
          const items = inReview.filter((record) => bucket.match(record.days));
          const value = items.reduce((sum, record) => sum + (record.job.contract_value ?? 0), 0);
          return (
            <section key={bucket.label} className="w-72 shrink-0 space-y-2">
              <Card className={`gap-1 py-3 ${bucket.border}`}>
                <CardHeader className="flex-row items-center justify-between px-4 py-0">
                  <CardTitle className={`text-sm ${bucket.tone}`}>{bucket.label}</CardTitle>
                  <span className={`text-sm font-semibold ${bucket.tone}`}>{items.length}</span>
                </CardHeader>
                <CardContent className="px-4 text-xs text-muted-foreground">{currency(value)}</CardContent>
              </Card>
              <div className="space-y-2">
                {items.map(({ job, days }) => (
                  <div
                    key={job.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onOpen(job)}
                    onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onOpen(job); } }}
                    className="w-full cursor-pointer rounded-xl border bg-card p-3 text-left shadow-sm transition-colors hover:border-primary"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium">{job.client_name}</p>
                      <Badge variant="outline" className={bucket.tone}>{days}d</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">#<Link href={`/jobs/${job.id}`} onClick={(event) => event.stopPropagation()} className="font-medium text-primary hover:underline">{job.job_number}</Link>{job.trade_type ? ` · ${job.trade_type}` : ""}</p>
                    {job.jurisdiction && <p className="mt-0.5 text-xs text-muted-foreground">{job.jurisdiction}</p>}
                    {job.permit_number && <p className="truncate text-xs text-muted-foreground">{job.permit_number}</p>}
                    {job.contract_value != null && <p className="mt-1 text-right text-sm font-medium text-primary">{currency(job.contract_value)}</p>}
                  </div>
                ))}
                {items.length === 0 && <Card className="py-6 text-center text-xs text-muted-foreground">None</Card>}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
