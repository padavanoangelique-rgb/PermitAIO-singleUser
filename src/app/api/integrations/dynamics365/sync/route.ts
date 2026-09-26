import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canManageOrg, type MemberRole } from "@/lib/data/orgs";
import { refreshAccessToken, pushJobToDynamics365 } from "@/lib/crm/dynamics365";

/**
 * Pushes one PermitAIO job into the org's connected Dynamics 365 environment
 * as an Account + Opportunity — creates them on first sync, updates the same
 * Opportunity (matched by jobs.external_job_id) every sync after.
 *
 * Auth: `jobs` is RLS-protected (is_org_member), so the job select below
 * already scopes to orgs the caller belongs to — a job in another org's
 * workspace simply won't be found.
 */
export async function POST(request: NextRequest) {
  let body: { jobId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!body.jobId) {
    return NextResponse.json({ error: "jobId is required." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  // New jobs columns (external_job_id, sync_status, ...) aren't in the
  // generated Database type yet — cast until types are regenerated.
  const jobsTable = supabase as unknown as { from: (t: string) => any };

  const { data: job, error: jobError } = await jobsTable
    .from("jobs")
    .select(
      "id, org_id, job_number, client_name, address, trade_type, contract_value, stage, external_job_id",
    )
    .eq("id", body.jobId)
    .single();

  if (jobError || !job) {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }

  // Only owners/admins may push to a connected CRM — matches who can see
  // and manage the connection itself on the Settings page.
  const { data: membership } = await supabase
    .from("organization_members")
    .select("role")
    .eq("org_id", job.org_id)
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (!membership || !canManageOrg(membership.role as MemberRole)) {
    return NextResponse.json(
      { error: "Only an owner or admin can sync jobs to a connected CRM." },
      { status: 403 },
    );
  }

  const admin = createAdminClient() as unknown as { from: (t: string) => any };

  const { data: connection, error: connectionError } = await admin
    .from("crm_connections")
    .select("id, environment_url, refresh_token, access_token, access_token_expires_at, status")
    .eq("org_id", job.org_id)
    .eq("provider", "dynamics365")
    .maybeSingle();

  if (connectionError || !connection || connection.status !== "active") {
    return NextResponse.json(
      { error: "Dynamics 365 isn't connected for this organization." },
      { status: 400 },
    );
  }

  let accessToken: string | null = connection.access_token;
  const expiresAt = connection.access_token_expires_at
    ? new Date(connection.access_token_expires_at).getTime()
    : 0;
  const needsRefresh = !accessToken || expiresAt - Date.now() < 60_000;

  if (needsRefresh) {
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
      return NextResponse.json(
        { error: "Dynamics 365 connection has expired. Reconnect it in Settings." },
        { status: 502 },
      );
    }
  }

  try {
    const result = await pushJobToDynamics365({
      environmentUrl: connection.environment_url,
      accessToken: accessToken!,
      job: {
        id: job.id,
        jobNumber: job.job_number,
        clientName: job.client_name,
        address: job.address,
        tradeType: job.trade_type,
        contractValue: job.contract_value,
        stage: job.stage,
      },
      existingExternalJobId: job.external_job_id,
    });

    await jobsTable
      .from("jobs")
      .update({
        external_source: "dynamics365",
        external_customer_id: result.externalCustomerId,
        external_job_id: result.externalJobId,
        external_job_url: result.externalJobUrl,
        last_synced_at: new Date().toISOString(),
        sync_status: "synced",
      })
      .eq("id", job.id);

    await admin.from("crm_sync_events").insert({
      org_id: job.org_id,
      connection_id: connection.id,
      job_id: job.id,
      direction: "push",
      entity_type: "opportunity",
      external_id: result.externalJobId,
      status: "success",
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    await jobsTable.from("jobs").update({ sync_status: "error" }).eq("id", job.id);
    await admin.from("crm_sync_events").insert({
      org_id: job.org_id,
      connection_id: connection.id,
      job_id: job.id,
      direction: "push",
      entity_type: "opportunity",
      status: "error",
      error_message: String(err),
    });
    return NextResponse.json({ error: "Sync to Dynamics 365 failed." }, { status: 502 });
  }
}
