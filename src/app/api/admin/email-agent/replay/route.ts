import { NextResponse } from "next/server";
import { isPlatformAdmin } from "@/lib/data/platform-admin";
import { getValidAccessToken } from "@/lib/gmail/db";
import { addLabelToMessage, ensureLabel, listRecentInboxMessageIds } from "@/lib/gmail/labels";
import { getFullMessageContent } from "@/lib/gmail/message-content";
import { modifyMessageLabels } from "@/lib/gmail/message-labels";
import { isIntakeEmail } from "@/lib/agents/job-intake/parse";
import { isBulkEmail } from "@/lib/agents/bulk-update/parse";
import { routeInboundEmail } from "@/lib/agents/route-inbound";

const NEEDS_REVIEW_LABEL = "PermitAIO/Needs Review";
const PROCESSED_LABEL = "PermitAIO/Processed";
const INTAKE_LABEL = "PermitAIO/Intake";
const BULK_LABEL = "PermitAIO/Bulk";

export async function POST() {
  if (!(await isPlatformAdmin())) {
    return NextResponse.json({ error: "Platform admin only." }, { status: 403 });
  }

  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    return NextResponse.json({ ok: false, error: "No Gmail token." }, { status: 502 });
  }

  const messageIds = await listRecentInboxMessageIds(accessToken, 12);
  const needsReviewLabelId = await ensureLabel(accessToken, NEEDS_REVIEW_LABEL);
  const processedLabelId = await ensureLabel(accessToken, PROCESSED_LABEL);
  const intakeLabelId = await ensureLabel(accessToken, INTAKE_LABEL);
  const bulkLabelId = await ensureLabel(accessToken, BULK_LABEL);

  for (const messageId of messageIds) {
    const content = await getFullMessageContent(accessToken, messageId);
    const bulk = isBulkEmail(content.subject, content.body);
    const intake = !bulk && isIntakeEmail(content.subject, content.body);
    await addLabelToMessage(
      accessToken,
      messageId,
      bulk ? bulkLabelId : intake ? intakeLabelId : needsReviewLabelId,
    );

    const result = await routeInboundEmail({
      messageId: content.id,
      from: content.from,
      to: content.to,
      subject: content.subject,
      body: content.body,
      receivedAt: content.internalDate
        ? new Date(Number(content.internalDate)).toISOString()
        : undefined,
    });

    if (result.noteAdded && !result.requiresReview) {
      await modifyMessageLabels(accessToken, messageId, {
        addLabelIds: [processedLabelId],
        removeLabelIds: [needsReviewLabelId, intakeLabelId, bulkLabelId],
      });
    }
  }

  return NextResponse.redirect(new URL("/admin/email-agent", process.env.NEXT_PUBLIC_APP_URL || "https://permitaio.com"), 303);
}
