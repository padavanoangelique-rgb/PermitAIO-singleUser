import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/notifications/notify";
import {
  jobToken,
  parsePortalStatus,
  scoutSentence,
  scoutToken,
  shouldNotifyScout,
  todayIsoET,
  type ScoutStatus,
} from "@/lib/chat/answer-rules";

type AnyAdmin = ReturnType<typeof createAdminClient>;

function from(admin: AnyAdmin, name: string) {
  return (admin as unknown as { from: (t: string) => any }).from(name);
}

type ScoutJob = {
  id: string;
  org_id: string;
  job_number: string;
  client_name: string;
  permit_number: string | null;
  jurisdiction: string | null;
  permit_tech: string | null;
  sub_status: string;
};

const FETCH_MS = 8000;
/** A scheduled run stops starting new checks after this long, so it always finishes inside the function limit. */
const RUN_BUDGET_MS = 240_000;
const CONCURRENCY = 4;
const CANDIDATE_POOL = 300;

/** Public web addresses only: no localhost, private ranges or internal hosts. */
function isPublicWebUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return false;
  const host = u.hostname.toLowerCase();
  if (!host || host === "localhost" || host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".localhost")) return false;
  if (host.includes(":") || host.startsWith("[")) return false; // IPv6 literals
  const ip = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ip) {
    const [a, b] = [Number(ip[1]), Number(ip[2])];
    if (a === 0 || a === 10 || a === 127) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
  }
  return true;
}

export async function fetchPublicPortal(url: string, permitNumber: string) {
  let target = url.trim();
  if (!/^https?:\/\//i.test(target)) return { error: "The portal link on file is not a public web address." };
  if (target.includes("{permit}")) target = target.replaceAll("{permit}", encodeURIComponent(permitNumber));
  if (!isPublicWebUrl(target)) return { error: "The portal link on file is not a public web address." };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_MS);
  try {
    const res = await fetch(target, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "PermitAIO-PermitScout/1.0 (public search; no login)",
      },
    });
    if (!res.ok) return { error: `Public page returned ${res.status}.` };
    const html = (await res.text()).slice(0, 200_000);
    return { html };
  } catch {
    return { error: "Public page did not respond." };
  } finally {
    clearTimeout(timer);
  }
}

async function portalFor(admin: AnyAdmin, jurisdiction: string | null) {
  const city = (jurisdiction ?? "").trim();
  if (!city) return null;
  const exact = await from(admin, "platform_registration_packets")
    .select("jurisdiction, public_portal_url, building_department")
    .ilike("jurisdiction", city)
    .limit(1);
  const row = exact.data?.[0] as { public_portal_url?: string | null; building_department?: string | null } | undefined;
  if (row?.public_portal_url) return row;
  const loose = await from(admin, "platform_registration_packets")
    .select("jurisdiction, public_portal_url, building_department")
    .ilike("jurisdiction", `%${city}%`)
    .limit(1);
  return (loose.data?.[0] as { public_portal_url?: string | null } | undefined) ?? row ?? null;
}

async function inflight(admin: AnyAdmin, orgId: string, jobId: string) {
  const since = new Date(Date.now() - 3 * 60 * 1000).toISOString();
  const { data } = await from(admin, "permit_scout_runs")
    .select("id")
    .eq("org_id", orgId)
    .eq("job_id", jobId)
    .eq("state", "running")
    .gte("started_at", since)
    .limit(1);
  return Boolean(data?.length);
}

async function latestScoutNote(admin: AnyAdmin, orgId: string, jobId: string) {
  const { data } = await from(admin, "job_activity")
    .select("message, created_at")
    .eq("org_id", orgId)
    .eq("job_id", jobId)
    .ilike("message", "%[Permit Scout]%")
    .order("created_at", { ascending: false })
    .limit(1);
  return (data?.[0] as { message: string; created_at: string } | undefined) ?? null;
}

/** A note is only worth writing when what Permit Scout found is different from its last note on this job. */
function sameAsLast(prior: { message: string } | null, status: ScoutStatus) {
  return Boolean(prior && prior.message.includes(scoutToken(status)));
}

async function writeNote(admin: AnyAdmin, job: ScoutJob, status: ScoutStatus, sentence: string) {
  const stamp = new Date().toISOString();
  const message = `[Permit Scout] ${stamp} ${scoutToken(status)} Job ${job.job_number}. ${sentence}`;
  await from(admin, "job_activity").insert({
    org_id: job.org_id,
    job_id: job.id,
    user_id: null,
    activity_type: "note",
    message,
  });
  return message;
}

async function notifyOnce(job: ScoutJob, status: ScoutStatus, sentence: string) {
  if (!shouldNotifyScout(status)) return;
  const admin = createAdminClient();
  const token = scoutToken(status);
  const { data } = await from(admin, "notifications")
    .select("id")
    .eq("org_id", job.org_id)
    .eq("job_id", job.id)
    .eq("source", "permit_scout")
    .ilike("message", `%${token}%`)
    .limit(1);
  if (data?.length) return;
  try {
    await notify({
      orgId: job.org_id,
      jobId: job.id,
      permitTech: job.permit_tech,
      source: "permit_scout",
      message: `${token} Job ${job.job_number}: ${sentence}`,
    });
  } catch (err) {
    console.error("permit scout notify failed", err);
  }
}

async function checkOne(admin: AnyAdmin, job: ScoutJob) {
  const city = job.jurisdiction?.trim() || "that city";
  if (!job.permit_number) {
    return {
      spoken: `I don't have a permit number on job ${job.job_number}, so Permit Scout has nothing to look up. The building department has the live record.`,
      status: "no_portal" as ScoutStatus,
    };
  }
  if (await inflight(admin, job.org_id, job.id)) {
    const prior = await latestScoutNote(admin, job.org_id, job.id);
    const spoken = prior
      ? `Permit Scout is already checking job ${job.job_number}. Latest note: ${prior.message}`
      : `Permit Scout is already checking job ${job.job_number}. I don't have a result yet.`;
    return { spoken, status: "mentioned" as ScoutStatus };
  }

  const packet = await portalFor(admin, job.jurisdiction);
  const url = packet?.public_portal_url?.trim() || "";
  const started = await from(admin, "permit_scout_runs")
    .insert({
      org_id: job.org_id,
      job_id: job.id,
      permit_number: job.permit_number,
      state: "running",
    })
    .select("id")
    .maybeSingle();
  const runId = started.data?.id as string | undefined;

  let status: ScoutStatus = "no_portal";
  let sentence = scoutSentence("no_portal", city);
  const prior = await latestScoutNote(admin, job.org_id, job.id);
  if (!url) {
    if (!sameAsLast(prior, status)) await writeNote(admin, job, status, sentence);
  } else {
    const page = await fetchPublicPortal(url, job.permit_number);
    if ("error" in page) {
      status = "not_on_page";
      sentence = `I don't have a live reading. ${page.error} The building department has the record.`;
      if (!sameAsLast(prior, status)) await writeNote(admin, job, status, sentence);
    } else {
      const parsed = parsePortalStatus(page.html, job.permit_number);
      status = parsed.status;
      sentence = scoutSentence(status, city);
      if (!sameAsLast(prior, status)) await writeNote(admin, job, status, sentence);
      await notifyOnce(job, status, sentence);
    }
  }

  if (runId) {
    await from(admin, "permit_scout_runs")
      .update({ state: "done", status_found: status, note: sentence, finished_at: new Date().toISOString() })
      .eq("id", runId);
  }
  const spoken = `Permit Scout checked the public ${city} page for permit ${job.permit_number} on job ${job.job_number}. ${sentence}`;
  return { spoken, status };
}

export async function scoutJobNow(orgId: string, text: string) {
  const number = jobToken(text);
  if (!number) {
    return { spoken: "Give me the job number and Permit Scout will check the public building-department page. I won't guess a status." };
  }
  const admin = createAdminClient();
  const { data } = await from(admin, "jobs")
    .select("id, org_id, job_number, client_name, permit_number, jurisdiction, permit_tech, sub_status")
    .eq("org_id", orgId)
    .eq("job_number", number)
    .maybeSingle();
  if (!data) {
    return { spoken: `I don't have job ${number}. The building department has the live record if it was filed.` };
  }
  return checkOne(admin, data as ScoutJob);
}

/**
 * Scheduled check for one organization. Only jobs whose city has a public portal address on file are
 * checked, least recently checked first, so over a few days every eligible job gets a turn instead of
 * the same few being re-checked. Stops starting new checks once the time budget is spent.
 */
export async function runPermitScoutForOrg(orgId: string, limit = 20, deadline = Date.now() + RUN_BUDGET_MS) {
  const admin = createAdminClient();

  const packets = await from(admin, "platform_registration_packets")
    .select("jurisdiction, public_portal_url")
    .not("public_portal_url", "is", null)
    .neq("public_portal_url", "");
  const portalCities = ((packets.data ?? []) as { jurisdiction: string | null }[])
    .map((p) => (p.jurisdiction ?? "").trim().toLowerCase())
    .filter(Boolean);
  if (portalCities.length === 0) {
    return { orgId, checked: 0, skipped: "no portal addresses on file yet", day: todayIsoET() };
  }

  const { data, error } = await from(admin, "jobs")
    .select("id, org_id, job_number, client_name, permit_number, jurisdiction, permit_tech, sub_status, submitted_date")
    .eq("org_id", orgId)
    .not("permit_number", "is", null)
    .neq("sub_status", "Complete")
    .order("submitted_date", { ascending: false, nullsFirst: false })
    .limit(CANDIDATE_POOL);
  if (error) return { orgId, checked: 0, error: error.message, day: todayIsoET() };

  const eligible = ((data ?? []) as ScoutJob[]).filter((job) => {
    const city = (job.jurisdiction ?? "").trim().toLowerCase();
    if (!job.permit_number || !city) return false;
    return portalCities.some((p) => p === city || p.includes(city) || city.includes(p));
  });
  if (eligible.length === 0) return { orgId, checked: 0, skipped: "no jobs in cities with a portal", day: todayIsoET() };

  const runs = await from(admin, "permit_scout_runs")
    .select("job_id, started_at")
    .eq("org_id", orgId)
    .in("job_id", eligible.map((j) => j.id))
    .order("started_at", { ascending: false })
    .limit(2000);
  const lastRun = new Map<string, string>();
  for (const r of (runs.data ?? []) as { job_id: string; started_at: string }[]) {
    if (!lastRun.has(r.job_id)) lastRun.set(r.job_id, r.started_at);
  }
  const queue = eligible
    .slice()
    .sort((a, b) => (lastRun.get(a.id) ?? "").localeCompare(lastRun.get(b.id) ?? ""))
    .slice(0, limit);

  let checked = 0;
  let index = 0;
  async function worker() {
    while (index < queue.length && Date.now() < deadline) {
      const job = queue[index++];
      try {
        await checkOne(admin, job);
        checked += 1;
      } catch (err) {
        console.error("permit scout job failed", job.job_number, err);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, () => worker()));
  return { orgId, checked, queued: queue.length, day: todayIsoET() };
}

export async function runPermitScoutAll(limitPerOrg = 20) {
  const admin = createAdminClient();
  const { data, error } = await admin.from("organizations").select("id");
  if (error) return { ok: false, error: error.message, orgs: [] as unknown[] };
  const deadline = Date.now() + RUN_BUDGET_MS;
  const orgs = [];
  for (const org of data ?? []) {
    orgs.push(await runPermitScoutForOrg(org.id, limitPerOrg, deadline));
  }
  return { ok: true, orgs };
}
