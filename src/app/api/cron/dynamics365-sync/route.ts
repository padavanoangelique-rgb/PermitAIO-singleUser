import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  refreshAccessToken,
  findReadyForProductionOpportunities,
  linkOpportunityToJob,
  getOpportunityStatus,
  pushJobStatus,
  pushMilestoneDate,
  pushApprovedPdf,
} from "@/lib/crm/dynamics365";

/**
 * Scheduled bidirectional sync between every connected org's Dynamics 365
 * environment and PermitAIO, invoked on a schedule by Vercel Cron (see
 * vercel.json) with `Authorization: Bearer ${CRON_SECRET}`.
 *
 * Fails closed, same pattern as the Gmail cron (src/app/api/cron/gmail-check):
 * a missing CRON_SECRET is a misconfiguration, not an open endpoint — this
 * route pushes to a real customer CRM and creates real PermitAIO jobs, so it
 * must never be callable without the secret. Previously this only checked
 * the header when CRON_SECRET happened to be set, which left the route
 * fully unauthenticated in any environment where the var was never
 * configured.
 *
 * Each connected org goes through four steps, each independently
 * idempotent so a failure partway through one org never blocks the rest or
 * duplicates work on the next run:
 *
 *  1. Inbound create — an Opportunity flagged "ready for production" with
 *     no linked PermitAIO job yet gets one created, then is linked back via
 *     new_permitaiojobnumber (which is what stops it from being picked up
 *     again next run).
 *  2. Bidirectional status — for every already-linked job, compare which
 *     side changed more recently (Dataverse's modifiedon vs. this job's own
 *     last-pulled timestamp) and propagate that side's stage to the other,
 *     so a change made in either PermitAIO or Dynamics 365 shows up in both.
 *  3. Outbound milestone dates — submitted_date / approved_date push once,
 *     guarded by their own "already pushed" flags.
 *  4. Outbound approved-permit PDF — best-effort attach of the job's most
 *     recently uploaded file when the approved-date push fires; skipped
 *     quietly if the job has no files yet.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 503 });
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const admin = createAdminClient() as unknown as {
    from: (t: string) => any;
    storage: { from: (bucket: string) => { download: (path: string) => Promise<{ data: Blob | null; error: unknown }> } };
  };

  const { data: connections, error: connectionsError } = await admin
    .from("crm_connections")
    .select("id, org_id, environment_url, refresh_token, access_token, access_token_expires_at, status")
    .eq("provider", "dynamics365")
    .eq("status", "active");

  if (connectionsError) {
    return NextResponse.json({ error: "Failed to load connections." }, { status: 500 });
  }

  const summary: Record<string, unknown>[] = [];

  for (const connection of connections ?? []) {
    const orgSummary: Record<string, unknown> = { org_id: connection.org_id, created: 0, statusPushed: 0, statusPulled: 0, datesPushed: 0, errors: [] as string[] };

    let accessToken: string = connection.access_token;
    const expiresAt = connection.access_token_expires_at
      ? new Date(connection.access_token_expires_at).getTime()
      : 0;
    if (!accessToken || expiresAt - Date.now() < 60_000) {
      try {
        const refreshed = await refreshAccessToken({
          refreshToken: connection.refresh_token,
          environmentUrl: connection.environment_url,
        });
        accessToken = refreshed.accessToken;
        await admin
          .from("crm_connections")
          .update({
            access_token: refreshed.accessToken,
            refresh_token: refreshed.refreshToken,
            access_token_expires_at: refreshed.expiresAt,
          })
          .eq("id", connection.id);
      } catch (err) {
        await admin
          .from("crm_connections")
          .update({ status: "error", last_error: String(err) })
          .eq("id", connection.id);
        orgSummary.errors = [`token refresh failed: ${String(err)}`];
        summary.push(orgSummary);
        continue;
      }
    }

    const environmentUrl = connection.environment_url as string;

    // --- 1. Inbound create -------------------------------------------------
    try {
      const ready = await findReadyForProductionOpportunities(environmentUrl, accessToken);
      for (const opp of ready) {
        try {
          const { data: stages } = await admin
            .from("stages")
            .select("name")
            .eq("org_id", connection.org_id)
            .order("sort_order", { ascending: true })
            .limit(1);
          const initialStage = stages?.[0]?.name ?? "New";

          const jobNumber = `D365-${opp.opportunityId.slice(0, 8).toUpperCase()}`;
          const { data: job, error: insertError } = await admin
            .from("jobs")
            .insert({
              org_id: connection.org_id,
              client_name: opp.accountName ?? opp.name,
              job_number: jobNumber,
              trade_type: "other",
              stage: initialStage,
              external_source: "dynamics365",
              external_job_id: opp.opportunityId,
              sync_status: "synced",
              last_synced_at: new Date().toISOString(),
              d365_pushed_stage: initialStage,
              d365_last_pulled_at: opp.modifiedOn,
            })
            .select("id, job_number")
            .single();

          if (insertError || !job) throw insertError ?? new Error("insert returned no row");

          await linkOpportunityToJob(environmentUrl, accessToken, opp.opportunityId, job.job_number);
          await pushJobStatus(environmentUrl, accessToken, opp.opportunityId, initialStage);

          await admin.from("crm_sync_events").insert({
            org_id: connection.org_id,
            connection_id: connection.id,
            job_id: job.id,
            direction: "pull",
            entity_type: "opportunity",
            external_id: opp.opportunityId,
            status: "success",
            payload: { event: "job_created_from_opportunity" },
          });
          (orgSummary.created as number)++;
        } catch (err) {
          (orgSummary.errors as string[]).push(`create from ${opp.opportunityId}: ${String(err)}`);
        }
      }
    } catch (err) {
      (orgSummary.errors as string[]).push(`inbound create scan failed: ${String(err)}`);
    }

    // --- 2 & 3. Bidirectional status + milestone dates ----------------------
    const { data: linkedJobs } = await admin
      .from("jobs")
      .select(
        "id, job_number, stage, external_job_id, d365_pushed_stage, d365_last_pulled_at, submitted_date, approved_date, d365_submitted_pushed, d365_approved_pushed",
      )
      .eq("org_id", connection.org_id)
      .eq("external_source", "dynamics365")
      .not("external_job_id", "is", null);

    for (const job of linkedJobs ?? []) {
      try {
        const remote = await getOpportunityStatus(environmentUrl, accessToken, job.external_job_id);
        const lastPulled = job.d365_last_pulled_at ? new Date(job.d365_last_pulled_at).getTime() : 0;
        const remoteModified = new Date(remote.modifiedOn).getTime();
        const remoteChangedSinceLastPull = remoteModified > lastPulled;
        const remoteDiffersFromLocal = remote.jobStatus && remote.jobStatus !== job.stage;

        if (remoteChangedSinceLastPull && remoteDiffersFromLocal) {
          // Dynamics 365 changed more recently than our last look — mirror it here.
          await admin
            .from("jobs")
            .update({
              stage: remote.jobStatus,
              d365_pushed_stage: remote.jobStatus,
              d365_last_pulled_at: remote.modifiedOn,
            })
            .eq("id", job.id);
          await admin.from("crm_sync_events").insert({
            org_id: connection.org_id,
            connection_id: connection.id,
            job_id: job.id,
            direction: "pull",
            entity_type: "opportunity",
            external_id: job.external_job_id,
            status: "success",
            payload: { event: "status_pulled", stage: remote.jobStatus },
          });
          (orgSummary.statusPulled as number)++;
        } else if (job.stage !== job.d365_pushed_stage) {
          // PermitAIO changed since we last pushed — push it to Dynamics 365.
          await pushJobStatus(environmentUrl, accessToken, job.external_job_id, job.stage);
          await admin
            .from("jobs")
            .update({ d365_pushed_stage: job.stage, d365_last_pulled_at: new Date().toISOString() })
            .eq("id", job.id);
          await admin.from("crm_sync_events").insert({
            org_id: connection.org_id,
            connection_id: connection.id,
            job_id: job.id,
            direction: "push",
            entity_type: "opportunity",
            external_id: job.external_job_id,
            status: "success",
            payload: { event: "status_pushed", stage: job.stage },
          });
          (orgSummary.statusPushed as number)++;
        }

        if (job.submitted_date && !job.d365_submitted_pushed) {
          await pushMilestoneDate(
            environmentUrl,
            accessToken,
            job.external_job_id,
            "new_permitsubmitteddate",
            job.submitted_date,
          );
          await admin.from("jobs").update({ d365_submitted_pushed: true }).eq("id", job.id);
          (orgSummary.datesPushed as number)++;
        }

        if (job.approved_date && !job.d365_approved_pushed) {
          await pushMilestoneDate(
            environmentUrl,
            accessToken,
            job.external_job_id,
            "new_permitapproveddate",
            job.approved_date,
          );

          // Best-effort: attach the job's most recently uploaded file as the
          // approved permit PDF. Skipped quietly if the job has no files.
          try {
            const { data: files } = await admin
              .from("job_files")
              .select("file_name, storage_path")
              .eq("job_id", job.id)
              .order("uploaded_at", { ascending: false })
              .limit(1);
            const file = files?.[0];
            if (file) {
              const { data: blob, error: downloadError } = await admin.storage
                .from("job-files")
                .download(file.storage_path);
              if (!downloadError && blob) {
                const buffer = Buffer.from(await blob.arrayBuffer());
                await pushApprovedPdf(
                  environmentUrl,
                  accessToken,
                  job.external_job_id,
                  file.file_name,
                  buffer.toString("base64"),
                );
              }
            }
          } catch {
            // PDF attach is best-effort — the date push above already succeeded.
          }

          await admin.from("jobs").update({ d365_approved_pushed: true }).eq("id", job.id);
          (orgSummary.datesPushed as number)++;
        }
      } catch (err) {
        (orgSummary.errors as string[]).push(`sync ${job.job_number}: ${String(err)}`);
      }
    }

    summary.push(orgSummary);
  }

  return NextResponse.json({ ok: true, orgs: summary });
}
