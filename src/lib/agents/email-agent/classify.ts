import type { PermitEmailClassification, PermitEmailEvent } from "./types";

type Rule = {
  event: PermitEmailEvent;
  phrases: string[];
  recommendedAction: string;
};

const STATUS_OUT: Rule = {
  event: "client_update_request",
  phrases: [
    "need an update",
    "need a status",
    "need status",
    "update on this job",
    "update on the job",
    "update on job",
    "status on this job",
    "status on the job",
    "status on job",
    "what's the status",
    "whats the status",
    "what is the status",
    "any update",
    "checking in on",
    "can you update",
    "please update",
    "please advise",
    "where are we on",
    "how's the permit",
    "hows the permit",
    "how is the permit",
    "waiting on an update",
    "homeowner asking",
    "customer asking",
  ],
  recommendedAction: "Reply with a job update. Do not change PermitAIO status from this email.",
};

const STATUS_IN: Rule[] = [
  {
    event: "permit_approved",
    phrases: ["permit approved", "application approved", "approved permit", "plan review approved", "plans approved"],
    recommendedAction: "Review the approval and download/record the approved permit documents as needed.",
  },
  {
    event: "permit_issued",
    phrases: ["permit issued", "issued permit", "permit has been issued", "ready to print"],
    recommendedAction: "Review the issued permit and confirm the permit documents are ready for the next production step.",
  },
  {
    event: "corrections_required",
    phrases: ["corrections required", "correction required", "revisions required", "revise and resubmit", "review comments", "deficiency"],
    recommendedAction: "Review the correction notice and route the job for correction response.",
  },
  {
    event: "fees_due",
    phrases: ["fees due", "fee due", "payment required", "balance due", "pay fees"],
    recommendedAction: "Review the fee notice and confirm the amount/payment step before taking action.",
  },
  {
    event: "submitted_or_received",
    phrases: ["application received", "submittal received", "submission received", "under review", "in review"],
    recommendedAction: "Review the receipt and continue monitoring the permit review.",
  },
  {
    event: "inspection_update",
    phrases: ["inspection scheduled", "inspection result", "inspection passed", "inspection failed", "final inspection"],
    recommendedAction: "Review the inspection update and route it to the appropriate inspection workflow.",
  },
];

function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function firstHit(rule: Rule, text: string): PermitEmailClassification | null {
  const hits = rule.phrases.filter((phrase) => text.includes(phrase));
  if (hits.length === 0) return null;
  return {
    event: rule.event,
    confidence: Math.min(0.99, 0.72 + hits.length * 0.09),
    evidence: hits,
    recommendedAction: rule.recommendedAction,
  };
}

export function classifyPermitEmail(subject: string, body: string): PermitEmailClassification {
  const text = normalize(`${subject}\n${body}`);

  const statusOut = firstHit(STATUS_OUT, text);
  if (statusOut) return statusOut;

  for (const rule of STATUS_IN) {
    const hit = firstHit(rule, text);
    if (hit) return hit;
  }

  if (/permit|building department|inspection|application|plan review|jurisdiction/.test(text)) {
    return {
      event: "general_update",
      confidence: 0.55,
      evidence: ["Permit-related terminology detected, but no specific action rule matched."],
      recommendedAction: "Human review required. No automatic PermitAIO change should be made.",
    };
  }

  return {
    event: "unknown",
    confidence: 0.2,
    evidence: [],
    recommendedAction: "No permit event could be identified. Human review required.",
  };
}

export function isStatusOutEvent(event: PermitEmailEvent): boolean {
  return event === "client_update_request";
}

export function isStatusInEvent(event: PermitEmailEvent): boolean {
  return (
    event === "permit_approved" ||
    event === "permit_issued" ||
    event === "corrections_required" ||
    event === "fees_due" ||
    event === "submitted_or_received" ||
    event === "inspection_update"
  );
}
