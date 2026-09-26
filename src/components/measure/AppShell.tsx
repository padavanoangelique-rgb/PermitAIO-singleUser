"use client";

import { useEffect } from "react";
import { PlanCanvas } from "./Canvas";
import { Chrome } from "./Chrome";
import { usePlanStore } from "@/lib/measure/store";
import type { Plan } from "@/lib/measure/types";

export function AppShell({
  hostPlan,
  jobs = [],
}: {
  hostPlan?: Plan | null;
  jobs?: { jobNumber: string; address: string }[];
}) {
  const hydrate = usePlanStore((s) => s.hydrate);

  useEffect(() => {
    usePlanStore.getState().setOrgJobs(jobs);
    hydrate();
    if (hostPlan) usePlanStore.getState().importPlan(hostPlan);
  }, [hydrate, hostPlan, jobs]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-paper text-ink">
      <PlanCanvas />
      <Chrome />
    </div>
  );
}
