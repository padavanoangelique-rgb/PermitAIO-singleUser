"use client";

import { AppShell } from "@/components/measure/AppShell";
import {
  bindMeasureHost,
  injectHostJob,
  setOrgJobList,
  type HostJob,
} from "@/lib/measure/integration";
import type { Plan } from "@/lib/measure/types";
import { lookupMeasureJob, saveMeasureAction, submitMeasureAction } from "./actions";

export function MeasureApp({
  jobs,
  host,
}: {
  jobs: { jobNumber: string; address: string }[];
  host: (HostJob & { plan: Plan | null }) | null;
}) {
  setOrgJobList(jobs);
  injectHostJob(host ? { jobNumber: host.jobNumber, address: host.address } : null);
  bindMeasureHost({
    lookup: lookupMeasureJob,
    save: saveMeasureAction,
    submit: submitMeasureAction,
  });

  return <AppShell hostPlan={host?.plan ?? null} jobs={jobs} />;
}
