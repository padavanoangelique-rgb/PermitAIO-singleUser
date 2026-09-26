import "server-only";
import { createHmac, timingSafeEqual } from "crypto";

/**
 * Dynamics 365 / Dataverse adapter. PermitAIO's Entra app registration is
 * multi-tenant ("Allow all tenants"), so every function here works against
 * ANY organization's own Dynamics 365 environment — the caller always
 * supplies that org's `environmentUrl` (e.g. https://contoso.crm.dynamics.com),
 * never a hardcoded PermitAIO environment.
 */

const AUTHORITY = "https://login.microsoftonline.com/organizations/oauth2/v2.0";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set.`);
  return value;
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  const payload = token.split(".")[1];
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
}

// ---------------------------------------------------------------------------
// OAuth state — signed so a party who doesn't hold DYNAMICS_365_CLIENT_SECRET
// can't forge a callback that attaches a stolen auth code to a different
// org_id. Paired with a short-lived nonce cookie for CSRF protection.
// ---------------------------------------------------------------------------

export interface OAuthState {
  orgId: string;
  environmentUrl: string;
  nonce: string;
}

export function signOAuthState(state: OAuthState): string {
  const encoded = Buffer.from(JSON.stringify(state)).toString("base64url");
  const signature = createHmac("sha256", requireEnv("DYNAMICS_365_CLIENT_SECRET"))
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${signature}`;
}

export function verifyOAuthState(state: string): OAuthState | null {
  const [encoded, signature] = state.split(".");
  if (!encoded || !signature) return null;

  const expected = createHmac("sha256", requireEnv("DYNAMICS_365_CLIENT_SECRET"))
    .update(encoded)
    .digest("base64url");

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    return JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as OAuthState;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// OAuth flow
// ---------------------------------------------------------------------------

export function buildAuthorizeUrl(params: {
  environmentUrl: string;
  redirectUri: string;
  state: string;
}): string {
  const url = new URL(`${AUTHORITY}/authorize`);
  url.searchParams.set("client_id", requireEnv("DYNAMICS_365_CLIENT_ID"));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("response_mode", "query");
  url.searchParams.set(
    "scope",
    `${params.environmentUrl}/user_impersonation offline_access openid profile`,
  );
  url.searchParams.set("state", params.state);
  url.searchParams.set("prompt", "select_account");
  return url.toString();
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  id_token?: string;
}

async function requestToken(body: URLSearchParams): Promise<TokenResponse> {
  const res = await fetch(`${AUTHORITY}/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Dynamics 365 token request failed: ${res.status} ${text}`);
  }
  return (await res.json()) as TokenResponse;
}

export async function exchangeCodeForToken(params: {
  code: string;
  redirectUri: string;
  environmentUrl: string;
}): Promise<{ accessToken: string; refreshToken: string; expiresAt: string; tenantId: string }> {
  const json = await requestToken(
    new URLSearchParams({
      client_id: requireEnv("DYNAMICS_365_CLIENT_ID"),
      client_secret: requireEnv("DYNAMICS_365_CLIENT_SECRET"),
      grant_type: "authorization_code",
      code: params.code,
      redirect_uri: params.redirectUri,
      scope: `${params.environmentUrl}/user_impersonation offline_access openid profile`,
    }),
  );

  let tenantId = "";
  if (json.id_token) {
    try {
      tenantId = (decodeJwtPayload(json.id_token).tid as string) ?? "";
    } catch {
      // Informational only — a missing tenant id never blocks the connection.
    }
  }

  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: new Date(Date.now() + json.expires_in * 1000).toISOString(),
    tenantId,
  };
}

export async function refreshAccessToken(params: {
  refreshToken: string;
  environmentUrl: string;
}): Promise<{ accessToken: string; refreshToken: string; expiresAt: string }> {
  const json = await requestToken(
    new URLSearchParams({
      client_id: requireEnv("DYNAMICS_365_CLIENT_ID"),
      client_secret: requireEnv("DYNAMICS_365_CLIENT_SECRET"),
      grant_type: "refresh_token",
      refresh_token: params.refreshToken,
      scope: `${params.environmentUrl}/user_impersonation offline_access openid profile`,
    }),
  );

  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? params.refreshToken,
    expiresAt: new Date(Date.now() + json.expires_in * 1000).toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Dataverse Web API — pushing a PermitAIO job as an Account + Opportunity
// ---------------------------------------------------------------------------

async function dataverseFetch(
  environmentUrl: string,
  accessToken: string,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const res = await fetch(`${environmentUrl}/api/data/v9.2/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
      accept: "application/json",
      "OData-MaxVersion": "4.0",
      "OData-Version": "4.0",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Dataverse API error (${path}): ${res.status} ${text}`);
  }
  return res;
}

/** Finds the Account for this job's client by exact name match, or creates
 * one. Vanilla Dataverse has no custom "PermitAIO client id" field to match
 * on, so name match is the pragmatic first-pass strategy. */
async function findOrCreateAccount(
  environmentUrl: string,
  accessToken: string,
  clientName: string,
): Promise<string> {
  const filter = encodeURIComponent(`name eq '${clientName.replace(/'/g, "''")}'`);
  const findRes = await dataverseFetch(
    environmentUrl,
    accessToken,
    `accounts?$select=accountid&$filter=${filter}&$top=1`,
  );
  const found = (await findRes.json()) as { value: { accountid: string }[] };
  if (found.value.length > 0) return found.value[0].accountid;

  const createRes = await dataverseFetch(environmentUrl, accessToken, "accounts", {
    method: "POST",
    body: JSON.stringify({ name: clientName }),
    headers: { Prefer: "return=representation" },
  });
  const created = (await createRes.json()) as { accountid: string };
  return created.accountid;
}

export interface JobForCrm {
  id: string;
  jobNumber: string;
  clientName: string;
  address: string | null;
  tradeType: string | null;
  contractValue: number | null;
  stage: string;
}

export interface CrmPushResult {
  externalCustomerId: string;
  externalJobId: string;
  externalJobUrl: string;
}

/** Pushes a job into Dynamics 365 as an Opportunity linked to an Account —
 * creates both on first sync, updates the same Opportunity (matched by
 * `existingExternalJobId`, stored on the job from the prior sync) after. */
export async function pushJobToDynamics365(params: {
  environmentUrl: string;
  accessToken: string;
  job: JobForCrm;
  existingExternalJobId?: string | null;
}): Promise<CrmPushResult> {
  const { environmentUrl, accessToken, job, existingExternalJobId } = params;

  const accountId = await findOrCreateAccount(environmentUrl, accessToken, job.clientName);

  const description = [
    job.address ? `Address: ${job.address}` : null,
    `Stage: ${job.stage}`,
    `PermitAIO Job #: ${job.jobNumber}`,
  ]
    .filter(Boolean)
    .join("\n");

  const body: Record<string, unknown> = {
    name: `${job.jobNumber} — ${job.tradeType ?? "Job"}`,
    description,
    "customerid_account@odata.bind": `/accounts(${accountId})`,
  };
  if (job.contractValue != null) body.estimatedvalue = job.contractValue;

  let opportunityId = existingExternalJobId ?? null;
  if (opportunityId) {
    await dataverseFetch(environmentUrl, accessToken, `opportunities(${opportunityId})`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  } else {
    const createRes = await dataverseFetch(environmentUrl, accessToken, "opportunities", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { Prefer: "return=representation" },
    });
    const created = (await createRes.json()) as { opportunityid: string };
    opportunityId = created.opportunityid;
  }

  return {
    externalCustomerId: accountId,
    externalJobId: opportunityId,
    externalJobUrl: `${environmentUrl}/main.aspx?pagetype=entityrecord&etn=opportunity&id=${opportunityId}`,
  };
}

// ---------------------------------------------------------------------------
// Bidirectional sync — inbound job creation, two-way status mirroring, and
// one-time milestone-date/PDF pushes. All of this reads/writes five custom
// Opportunity columns (publisher prefix "new", the environment's default):
//   new_readyforproduction (Yes/No)   — sales flips this once financing signs
//                                       off; PermitAIO watches for it
//   new_permitaiojobnumber (text)     — written back once PermitAIO creates
//                                       the linked Job, doubles as "already
//                                       created" guard so we never duplicate
//   new_jobstatus (text)              — mirrors jobs.stage; either side may
//                                       write it, most-recently-modified wins
//   new_permitsubmitteddate (date)    — written once, from jobs.submitted_date
//   new_permitapproveddate (date)     — written once, from jobs.approved_date
// ---------------------------------------------------------------------------

export interface ReadyOpportunity {
  opportunityId: string;
  name: string;
  accountName: string | null;
  modifiedOn: string;
}

/** Opportunities flagged ready-for-production that don't have a linked
 * PermitAIO job yet — the `new_permitaiojobnumber eq null` half of the
 * filter is what makes this idempotent across repeated cron runs. */
export async function findReadyForProductionOpportunities(
  environmentUrl: string,
  accessToken: string,
): Promise<ReadyOpportunity[]> {
  const filter = encodeURIComponent(
    "new_readyforproduction eq true and (new_permitaiojobnumber eq null or new_permitaiojobnumber eq '')",
  );
  const res = await dataverseFetch(
    environmentUrl,
    accessToken,
    `opportunities?$select=opportunityid,name,modifiedon&$expand=customerid_account($select=name)&$filter=${filter}`,
  );
  const data = (await res.json()) as {
    value: {
      opportunityid: string;
      name: string;
      modifiedon: string;
      customerid_account: { name: string } | null;
    }[];
  };
  return data.value.map((o) => ({
    opportunityId: o.opportunityid,
    name: o.name,
    accountName: o.customerid_account?.name ?? null,
    modifiedOn: o.modifiedon,
  }));
}

/** Writes the newly-created PermitAIO job number back onto the Opportunity —
 * this is what stops `findReadyForProductionOpportunities` from picking the
 * same Opportunity up again on the next poll. */
export async function linkOpportunityToJob(
  environmentUrl: string,
  accessToken: string,
  opportunityId: string,
  jobNumber: string,
): Promise<void> {
  await dataverseFetch(environmentUrl, accessToken, `opportunities(${opportunityId})`, {
    method: "PATCH",
    body: JSON.stringify({ new_permitaiojobnumber: jobNumber }),
  });
}

export interface OpportunityStatus {
  jobStatus: string | null;
  modifiedOn: string;
}

/** Reads the mirrored status + modifiedon so the caller can decide which
 * side changed more recently before overwriting either one. */
export async function getOpportunityStatus(
  environmentUrl: string,
  accessToken: string,
  opportunityId: string,
): Promise<OpportunityStatus> {
  const res = await dataverseFetch(
    environmentUrl,
    accessToken,
    `opportunities(${opportunityId})?$select=new_jobstatus,modifiedon`,
  );
  const data = (await res.json()) as { new_jobstatus: string | null; modifiedon: string };
  return { jobStatus: data.new_jobstatus, modifiedOn: data.modifiedon };
}

/** Pushes PermitAIO's current job stage into the mirrored status field. */
export async function pushJobStatus(
  environmentUrl: string,
  accessToken: string,
  opportunityId: string,
  status: string,
): Promise<void> {
  await dataverseFetch(environmentUrl, accessToken, `opportunities(${opportunityId})`, {
    method: "PATCH",
    body: JSON.stringify({ new_jobstatus: status }),
  });
}

/** One-time milestone date push (permit submitted / permit approved). */
export async function pushMilestoneDate(
  environmentUrl: string,
  accessToken: string,
  opportunityId: string,
  field: "new_permitsubmitteddate" | "new_permitapproveddate",
  isoDate: string,
): Promise<void> {
  await dataverseFetch(environmentUrl, accessToken, `opportunities(${opportunityId})`, {
    method: "PATCH",
    body: JSON.stringify({ [field]: isoDate }),
  });
}

/** Attaches the approved permit PDF to the Opportunity as a note, via the
 * Dataverse `annotations` entity (the standard way to carry a file onto any
 * record without a bespoke document-management setup). */
export async function pushApprovedPdf(
  environmentUrl: string,
  accessToken: string,
  opportunityId: string,
  fileName: string,
  base64Content: string,
): Promise<void> {
  await dataverseFetch(environmentUrl, accessToken, "annotations", {
    method: "POST",
    body: JSON.stringify({
      "objectid_opportunity@odata.bind": `/opportunities(${opportunityId})`,
      objecttypecode: "opportunity",
      subject: "Approved Permit (PermitAIO)",
      filename: fileName,
      documentbody: base64Content,
      mimetype: "application/pdf",
    }),
  });
}
