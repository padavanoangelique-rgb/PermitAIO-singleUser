import type { Plan } from "@/lib/measure/types";
import { openingInches, scheduleRows } from "@/lib/measure/schedule";

export type MeasurePayload = {
  version: 1;
  jobNumber: string;
  address: string;
  planName: string;
  measuredAt: string;
  walls: Plan["walls"];
  openings: Plan["openings"];
  labels: Plan["labels"];
  schedule: Array<{
    mark: string;
    type: string;
    config: string;
    widthFt: number;
    heightFt: number;
    widthIn: number;
    heightIn: number;
    room: string;
    notes: string;
  }>;
};

export type HostJob = {
  jobNumber: string;
  address?: string;
  contractorId?: string;
  userId?: string;
  userName?: string;
};

export type OrgJobLite = {
  jobNumber: string;
  address: string;
};

export type LookupResult = {
  found: boolean;
  jobNumber: string;
  address: string;
  jobId?: string;
  clientName?: string;
  plan: Plan | null;
};

type HostApi = {
  lookup: (jobNumber: string) => Promise<LookupResult>;
  save: (payload: MeasurePayload) => Promise<void>;
  submit: (payload: MeasurePayload) => Promise<void>;
};

let hostApi: HostApi | null = null;
let injectedHost: HostJob | null = null;
let orgJobs: OrgJobLite[] = [];

export function bindMeasureHost(api: HostApi) {
  hostApi = api;
}

export function injectHostJob(job: HostJob | null) {
  injectedHost = job;
}

export function setOrgJobList(jobs: OrgJobLite[]) {
  orgJobs = jobs;
}

export function getOrgJobList() {
  return orgJobs;
}

export function readHostJob(): HostJob | null {
  if (injectedHost?.jobNumber) return injectedHost;
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const job = params.get("job")?.trim();
  if (!job) return null;
  return {
    jobNumber: job,
    address: params.get("address")?.trim() || undefined,
  };
}

export function buildMeasurePayload(plan: Plan): MeasurePayload {
  return {
    version: 1,
    jobNumber: plan.jobNumber,
    address: plan.address,
    planName: plan.name,
    measuredAt: new Date(plan.updatedAt).toISOString(),
    walls: plan.walls,
    openings: plan.openings,
    labels: plan.labels,
    schedule: scheduleRows(plan).map((o) => {
      const { widthIn, heightIn } = openingInches(o);
      return {
        mark: o.mark,
        type: o.type,
        config: o.config,
        widthFt: o.width,
        heightFt: o.height,
        widthIn,
        heightIn,
        room: o.room,
        notes: o.notes,
      };
    }),
  };
}

export async function lookupJob(jobNumber: string): Promise<LookupResult> {
  if (hostApi) return hostApi.lookup(jobNumber);
  return { found: false, jobNumber, address: "", plan: null };
}

export async function saveMeasureToJob(payload: MeasurePayload): Promise<void> {
  if (hostApi) await hostApi.save(payload);
}

export async function submitMeasureToJob(payload: MeasurePayload): Promise<void> {
  if (hostApi) await hostApi.submit(payload);
}
