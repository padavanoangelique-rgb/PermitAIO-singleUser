export type PermitEmailEvent =
  | "client_update_request"
  | "permit_approved"
  | "permit_issued"
  | "corrections_required"
  | "fees_due"
  | "submitted_or_received"
  | "inspection_update"
  | "general_update"
  | "unknown";

export type EmailAgentInput = {
  messageId: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  receivedAt?: string;
  /** When set, only match jobs in this org (from {shop}_permitagent / _hoaagent). */
  orgId?: string;
  desk?: "permit" | "hoa" | "permits_dept";
};

export type EmailAgentJob = {
  id: string;
  org_id: string;
  job_number: string;
  client_name: string;
  permit_number: string | null;
  jurisdiction: string | null;
  address: string | null;
  sub_status: string;
  stage: string;
  permit_tech: string | null;
  hoa_tech?: string | null;
};

export type JobMatchReason = {
  field: "job_number" | "permit_number" | "address" | "client_name";
  weight: number;
  detail: string;
};

export type JobMatch = {
  job: EmailAgentJob;
  score: number;
  confidence: number;
  reasons: JobMatchReason[];
  ambiguous: boolean;
};

export type PermitEmailClassification = {
  event: PermitEmailEvent;
  confidence: number;
  evidence: string[];
  recommendedAction: string;
};

export type EmailAgentProcessResult = {
  messageIdHash: string;
  classification: PermitEmailClassification;
  match: JobMatch | null;
  noteAdded: boolean;
  requiresReview: boolean;
  reason: string;
};
