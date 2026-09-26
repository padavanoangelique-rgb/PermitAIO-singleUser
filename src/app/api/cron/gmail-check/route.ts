import { NextRequest, NextResponse } from "next/server";
import {
  getGmailConnection,
  getValidAccessToken,
  updateGmailHistoryId,
  isMessageProcessed,
  markMessageProcessed,
} from "@/lib/gmail/db";
import { getGmailProfile } from "@/lib/gmail/oauth";
import {
  ensureLabel,
  addLabelToMessage,
  listHistorySinceId,
  listRecentInboxMessageIds,
} from "@/lib/gmail/labels";
import { getFullMessageContent } from "@/lib/gmail/message-content";
import { modifyMessageLabels, trashMessage } from "@/lib/gmail/message-labels";
import { isIntakeEmail } from "@/lib/agents/job-intake/parse";
import { isBulkEmail } from "@/lib/agents/bulk-update/parse";
import { routeInboundEmail } from "@/lib/agents/route-inbound";
import { processPermitEmail, findOrgIdByMailboxPrefix } from "@/lib/agents/email-agent/process";
import { parseShopMailbox, PERMITS_DEPT_ALIAS } from "@/lib/chat/mailboxes";
import { orgIdForContractorAlias } from "@/lib/chat/contractor-alias";
import { fetchGmailAttachments, fileGmailReply, findOutboundThread } from "@/lib/job-emails/gmail-reply";

const NEEDS_REVIEW_LABEL = "PermitAIO/Needs Review";
const PROCESSED_LABEL = "PermitAIO/Processed";
const INTAKE_LABEL = "PermitAIO/Intake";
const BULK_LABEL = "PermitAIO/Bulk";

/** Anything addressed to this alias is jurisdiction/permit-department mail
 * with no job number — it never goes through the Data Agent, bulk, or
 * intake checks, just straight to the Email Agent's address/permit-number
 * matching. Delivers to the same connected mailbox (no separate OAuth
 * connection — Gmail aliases land in the same inbox, distinguished by the
 * `to:` header, which every message here already carries). */
const PERMITS_AGENT_ALIAS = PERMITS_DEPT_ALIAS;

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 503 });
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const connection = await getGmailConnection();
  if (!connection || connection.status !== "connected") {
    return NextResponse.json({ ok: true, skipped: "not_connected" });
  }

  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    return NextResponse.json(
      { ok: false, error: "Could not obtain a valid access token." },
      { status: 502 },
    );
  }

  let newMessageIds: string[];

  if (connection.gmail_history_id) {
    const history = await listHistorySinceId(accessToken, connection.gmail_history_id);
    newMessageIds = history.historyExpired
      ? await listRecentInboxMessageIds(accessToken, 20)
      : history.newMessageIds;
  } else {
    newMessageIds = [];
  }

  const needsReviewLabelId = newMessageIds.length
    ? await ensureLabel(accessToken, NEEDS_REVIEW_LABEL)
    : null;
  const intakeLabelId = newMessageIds.length ? await ensureLabel(accessToken, INTAKE_LABEL) : null;
  const bulkLabelId = newMessageIds.length ? await ensureLabel(accessToken, BULK_LABEL) : null;
  let processedLabelId: string | null = null;

  let examined = 0;
  let notesAdded = 0;
  let jobsCreated = 0;
  let jobsUpdated = 0;
  let repliesFiled = 0;
  let needsReview = 0;
  let trashed = 0;
  const errors: string[] = [];

  for (const messageId of newMessageIds) {
    try {
      if (await isMessageProcessed(messageId)) continue;
      examined++;

      const content = await getFullMessageContent(accessToken, messageId);
      const shopMail = parseShopMailbox(content.to);
      const isShopAgentMail = shopMail?.desk === "permit" || shopMail?.desk === "hoa";
      const isPermitsAgentMail = shopMail?.desk === "permits_dept" || content.to?.toLowerCase().includes(PERMITS_AGENT_ALIAS);

      if (isShopAgentMail || isPermitsAgentMail) {
        const orgId = shopMail?.prefix ? await findOrgIdByMailboxPrefix(shopMail.prefix) : undefined;
        if (isShopAgentMail && !orgId) {
          if (needsReviewLabelId) await addLabelToMessage(accessToken, messageId, needsReviewLabelId);
          needsReview++;
          await markMessageProcessed(messageId, content.threadId);
          continue;
        }
        const note = await processPermitEmail({
          messageId: content.id,
          from: content.from,
          to: content.to,
          subject: content.subject,
          body: content.body,
          receivedAt: content.internalDate
            ? new Date(Number(content.internalDate)).toISOString()
            : undefined,
          orgId: orgId ?? undefined,
          desk: shopMail?.desk,
        });
        if (note.noteAdded) {
          if (!processedLabelId) processedLabelId = await ensureLabel(accessToken, PROCESSED_LABEL);
          await modifyMessageLabels(accessToken, messageId, {
            addLabelIds: [processedLabelId],
            removeLabelIds: needsReviewLabelId ? [needsReviewLabelId] : [],
          });
          notesAdded++;
          // Jurisdiction/permit-department mail, not a contractor's own
          // correspondence — kept in the mailbox rather than trashed.
        } else {
          if (needsReviewLabelId) await addLabelToMessage(accessToken, messageId, needsReviewLabelId);
          needsReview++;
        }
        await markMessageProcessed(messageId, content.threadId);
        continue;
      }

      // Contractor main alias (guardian@permitaio.com, majestic@…): everything below is scoped to
      // that shop, so bulk updates and new-job intake land in the right organization.
      const aliasOrgId = await orgIdForContractorAlias(content.to);

      // A reply to an email sent from one of this shop's jobs (engineering request, etc.): file it
      // on the job with its attachments instead of running it through the status agents.
      if (aliasOrgId) {
        const thread = await findOutboundThread(aliasOrgId, content.subject);
        if (thread) {
          const attachments = await fetchGmailAttachments(accessToken, messageId).catch(() => []);
          const filed = await fileGmailReply({
            orgId: aliasOrgId,
            jobId: thread.jobId,
            sentBy: thread.sentBy,
            from: content.from,
            to: content.to,
            subject: content.subject,
            bodyText: content.body,
            gmailMessageId: content.id,
            attachments,
          });
          if (filed.filed) {
            if (!processedLabelId) processedLabelId = await ensureLabel(accessToken, PROCESSED_LABEL);
            await modifyMessageLabels(accessToken, messageId, {
              addLabelIds: [processedLabelId],
              removeLabelIds: [],
            });
            repliesFiled++;
          }
          // Kept in the mailbox (never trashed): this is someone's actual reply.
          await markMessageProcessed(messageId, content.threadId);
          continue;
        }
      }

      const bulk = isBulkEmail(content.subject, content.body);
      const intake = !bulk && isIntakeEmail(content.subject, content.body);

      if (bulk && bulkLabelId) {
        await addLabelToMessage(accessToken, messageId, bulkLabelId);
      } else if (intake && intakeLabelId) {
        await addLabelToMessage(accessToken, messageId, intakeLabelId);
      } else if (needsReviewLabelId) {
        await addLabelToMessage(accessToken, messageId, needsReviewLabelId);
      }

      const result = await routeInboundEmail({
        messageId: content.id,
        from: content.from,
        to: content.to,
        subject: content.subject,
        body: content.body,
        receivedAt: content.internalDate
          ? new Date(Number(content.internalDate)).toISOString()
          : undefined,
        orgId: aliasOrgId ?? undefined,
      });

      if (result.noteAdded && !result.requiresReview && needsReviewLabelId) {
        if (!processedLabelId) {
          processedLabelId = await ensureLabel(accessToken, PROCESSED_LABEL);
        }
        await modifyMessageLabels(accessToken, messageId, {
          addLabelIds: [processedLabelId],
          removeLabelIds: [needsReviewLabelId, intakeLabelId, bulkLabelId].filter(Boolean) as string[],
        });
        if (result.kind === "intake") jobsCreated += result.intakeCreated.length;
        else if (result.kind === "bulk") jobsUpdated += result.bulkUpdated.length;
        else notesAdded++;

        // Contractor-forwarded mail (job status, bulk updates, new-job
        // intake) is cleared out of the mailbox the moment it's
        // successfully processed — contractors shouldn't have to wonder
        // whether we're holding their email. Trash rather than permanent
        // delete, so a 30-day recovery window still exists if a processing
        // bug ever mis-handles a message.
        try {
          await trashMessage(accessToken, messageId);
          trashed++;
        } catch (trashErr) {
          errors.push(
            `${messageId} (trash): ${trashErr instanceof Error ? trashErr.message : String(trashErr)}`,
          );
        }
      } else {
        // Needs a human to look at it — never trashed. Deleting a message
        // that couldn't be confidently processed would defeat the entire
        // purpose of the "Needs Review" label.
        needsReview++;
      }

      await markMessageProcessed(messageId, content.threadId);
    } catch (err) {
      errors.push(`${messageId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const profile = await getGmailProfile(accessToken);
  if (errors.length === 0) {
    await updateGmailHistoryId(profile.historyId);
  } else {
    console.error("[gmail-check] per-message errors, historyId not advanced", errors);
  }

  return NextResponse.json({
    ok: true,
    checked: newMessageIds.length,
    examined,
    notesAdded,
    jobsCreated,
    jobsUpdated,
    repliesFiled,
    needsReview,
    trashed,
    errors,
  });
}
