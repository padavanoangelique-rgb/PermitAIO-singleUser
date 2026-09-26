import { processPermitEmail } from "@/lib/agents/email-agent/process";
import { isIntakeEmail } from "@/lib/agents/job-intake/parse";
import { processIntakeEmail } from "@/lib/agents/job-intake/process";
import { isBulkEmail } from "@/lib/agents/bulk-update/parse";
import { processBulkEmail } from "@/lib/agents/bulk-update/process";

export type RoutedResult = {
  kind: "bulk" | "intake" | "note";
  noteAdded: boolean;
  requiresReview: boolean;
  intakeCreated: string[];
  bulkUpdated: string[];
};

export async function routeInboundEmail(input: {
  messageId: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  receivedAt?: string;
  /** The contractor the message was addressed to (guardian@permitaio.com, etc). Scopes every agent to that shop. */
  orgId?: string;
}): Promise<RoutedResult> {
  if (isBulkEmail(input.subject, input.body)) {
    const bulk = await processBulkEmail({
      messageId: input.messageId,
      subject: input.subject,
      body: input.body,
      orgId: input.orgId,
    });
    return {
      kind: "bulk",
      noteAdded: bulk.updated.length > 0,
      requiresReview: bulk.updated.length === 0,
      intakeCreated: [],
      bulkUpdated: bulk.updated,
    };
  }

  if (isIntakeEmail(input.subject, input.body)) {
    const intake = await processIntakeEmail({
      messageId: input.messageId,
      subject: input.subject,
      body: input.body,
      orgId: input.orgId,
    });
    return {
      kind: "intake",
      noteAdded: intake.created.length > 0,
      requiresReview: intake.created.length === 0,
      intakeCreated: intake.created,
      bulkUpdated: [],
    };
  }

  const note = await processPermitEmail(input);
  return {
    kind: "note",
    noteAdded: note.noteAdded,
    requiresReview: note.requiresReview,
    intakeCreated: [],
    bulkUpdated: [],
  };
}
