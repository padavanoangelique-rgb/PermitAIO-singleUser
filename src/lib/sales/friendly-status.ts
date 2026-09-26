export type FriendlyStage = {
  key: string;
  title: string;
  short: string;
  description: string;
  next: string;
};

export const HOMEOWNER_STAGES: FriendlyStage[] = [
  {
    key: "getting_ready",
    title: "Getting your permit ready",
    short: "Getting ready",
    description: "We're gathering what the city needs and putting the permit package together so everything is correct before it is filed.",
    next: "Once the package is complete, it is submitted to the building department.",
  },
  {
    key: "submitted",
    title: "Submitted to the city",
    short: "Submitted",
    description: "Your permit has been filed with the city. Their review clock has started.",
    next: "The city typically takes about 3 weeks to review.",
  },
  {
    key: "under_review",
    title: "Under review",
    short: "Under review",
    description: "The city is actively reviewing the permit application and plans.",
    next: "Typical review is about 3 weeks from the day we filed.",
  },
  {
    key: "corrections",
    title: "The city asked for changes",
    short: "Corrections",
    description: "The city requested changes or extra information. We are handling that for you.",
    next: "Once those items are resolved, the package goes back into review.",
  },
  {
    key: "approved",
    title: "Permit approved — ready to build",
    short: "Approved",
    description: "Your permit is approved. Work can legally begin.",
    next: "Keep the permit documents on site. Inspections will be scheduled as the work progresses.",
  },
  {
    key: "closed",
    title: "Permit closed — all done",
    short: "Closed",
    description: "The project is complete and the permit has been closed with the city.",
    next: "No further action is required on the permit.",
  },
];

export const HOA_STAGES: { key: string; short: string }[] = [
  { key: "ready", short: "Getting ready" },
  { key: "submitted", short: "Submitted" },
  { key: "review", short: "Reviewing" },
  { key: "corrections", short: "Changes" },
  { key: "approved", short: "Approved" },
];

export function stageIndexFromJob(subStatus: string | null | undefined, stage: string | null | undefined) {
  const sub = (subStatus ?? "").toLowerCase();
  const st = (stage ?? "").toLowerCase();
  if (sub.includes("complete") || st.includes("complete") || st.includes("close")) return 5;
  if (sub.includes("approved")) return 4;
  if (sub.includes("correction")) return 3;
  if (sub.includes("review") || st.includes("review")) return 2;
  if (sub.includes("submit") || st.includes("submit")) return 1;
  return 0;
}

export function hoaStageIndex(status: string | null | undefined, hasHoa: boolean) {
  if (!hasHoa) return HOA_STAGES.length - 1;
  const s = (status ?? "").toLowerCase();
  if (s.includes("complete") || s.includes("approved")) return 4;
  if (s.includes("correction")) return 3;
  if (s.includes("review")) return 2;
  if (s.includes("submit")) return 1;
  return 0;
}

export function hoaPlain(status: string | null | undefined, hasHoa: boolean) {
  if (!hasHoa) {
    return {
      title: "No HOA on this job",
      detail: "This property is not tracking an association approval.",
      approved: true,
    };
  }
  const s = (status ?? "").toLowerCase();
  if (s.includes("complete") || s.includes("approved")) {
    return { title: "HOA approved", detail: "The association has signed off.", approved: true };
  }
  if (s.includes("review")) {
    return { title: "HOA is reviewing", detail: "Typical review is about 4 weeks from the day we filed.", approved: false };
  }
  if (s.includes("correction")) {
    return { title: "HOA asked for changes", detail: "The association requested extra information. We are handling it.", approved: false };
  }
  return { title: "HOA not submitted yet", detail: "The association package is being prepared. Typical review is about 4 weeks after we file.", approved: false };
}

export function formatShortDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso.includes("T") ? iso : `${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function addWeeks(iso: string, weeks: number) {
  const d = new Date(iso.includes("T") ? iso : `${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  d.setDate(d.getDate() + weeks * 7);
  return d.toISOString().slice(0, 10);
}

export const PERMIT_ETA_WEEKS = 3;
export const HOA_ETA_WEEKS = 4;

export function etaLabel(opts: {
  approved: boolean;
  submitted: string | null | undefined;
  weeks: number;
  waitingCopy: string;
}) {
  if (opts.approved) return "Approved";
  if (opts.submitted) {
    return `About ${opts.weeks} weeks — around ${formatShortDate(addWeeks(opts.submitted, opts.weeks))}`;
  }
  return opts.waitingCopy;
}

export function permitEtaLabel(submitted: string | null | undefined, approved: boolean) {
  return etaLabel({
    approved,
    submitted,
    weeks: PERMIT_ETA_WEEKS,
    waitingCopy: "About 3 weeks after we file with the city",
  });
}

export function hoaEtaLabel(submitted: string | null | undefined, approved: boolean, hasHoa: boolean) {
  if (!hasHoa) return "Not needed";
  return etaLabel({
    approved,
    submitted,
    weeks: HOA_ETA_WEEKS,
    waitingCopy: "About 4 weeks after we file with the HOA",
  });
}
