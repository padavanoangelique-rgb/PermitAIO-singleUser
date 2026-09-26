import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChatDesk } from "./bots";
import { isHowToQuery, matchSeedReports } from "./initial-reports";
import { average, canonicalJurisdiction, cycleDays } from "@/lib/inventory/constants";
import {
  SEARCH_SOURCES,
  emptyAnswer,
  formatTimeframeLine,
  hoaTurnaround,
  inWindow,
  isHoaDurationAsk,
  spokenJobs,
  spokenWeek,
  todayIsoET,
  weekFields,
  weekWindow,
  type DateField,
  type SearchSource,
  type SpokenJob,
} from "./answer-rules";

type AnyClient = SupabaseClient<any, any, any>;

export type SearchFacts = {
  text: string;
  jobCount: number;
  spoken: string;
  empty: boolean;
  sources: SearchSource[];
};

function days(from: string | null | undefined, to?: string | null) {
  if (!from) return null;
  const a = new Date(from);
  const b = to ? new Date(to) : new Date();
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function dayLabel(from: string | null | undefined, to?: string | null) {
  const n = days(from, to);
  if (n == null) return null;
  return n === 1 ? "1 day" : `${n} days`;
}

function md(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-US");
}

function like(raw: string) {
  return `%${raw.replace(/[%_,]/g, " ").trim()}%`;
}

function jobTokens(text: string) {
  const out = new Set<string>();
  for (const m of text.matchAll(/\b(?:job\s*#?\s*)?#?\s*([A-Za-z]{0,4}-?\d{3,})\b/gi)) {
    out.add(m[1]);
  }
  return [...out];
}

function table(supabase: AnyClient, name: string) {
  return (supabase as unknown as { from: (t: string) => any }).from(name);
}

function rowsOf(result: { data?: unknown; error?: { message?: string } | null }) {
  if (result?.error) return [];
  if (!result?.data) return [];
  return (Array.isArray(result.data) ? result.data : [result.data]) as Record<string, unknown>[];
}

const JOB_COLS =
  "id, job_number, client_name, address, city, jurisdiction, permit_number, sub_status, stage, permit_tech, hoa_tech, assigned_date, submitted_date, approved_date, ordered_date, material_eta, sale_date, notes, trade_type";

type JobRow = SpokenJob & {
  id: string;
  address: string | null;
  city: string | null;
  stage: string;
  permit_tech: string;
  hoa_tech: string;
  assigned_date: string | null;
  sale_date: string | null;
  notes: string | null;
  trade_type: string | null;
};

async function findJobs(supabase: AnyClient, orgId: string, query: string, tokens: string[]) {
  const byId = new Map<string, JobRow>();
  const q = query.trim();
  const pattern = like(q.slice(0, 80));
  const pulls = [
    ...tokens.slice(0, 4).flatMap((t) => [
      supabase.from("jobs").select(JOB_COLS).eq("org_id", orgId).eq("job_number", t).maybeSingle(),
      supabase.from("jobs").select(JOB_COLS).eq("org_id", orgId).ilike("job_number", `${t}%`).limit(5),
    ]),
    ...(q.length >= 2
      ? [
          supabase.from("jobs").select(JOB_COLS).eq("org_id", orgId).ilike("client_name", pattern).limit(6),
          supabase.from("jobs").select(JOB_COLS).eq("org_id", orgId).ilike("permit_number", pattern).limit(4),
          supabase.from("jobs").select(JOB_COLS).eq("org_id", orgId).ilike("address", pattern).limit(4),
        ]
      : []),
  ];
  const results = await Promise.all(pulls);
  for (const r of results) {
    for (const row of rowsOf(r) as unknown as JobRow[]) if (row?.id) byId.set(row.id, row);
  }
  return [...byId.values()].slice(0, 6);
}

async function jobsByDates(supabase: AnyClient, orgId: string, field: DateField, start: string, end: string) {
  const res = await supabase
    .from("jobs")
    .select(JOB_COLS)
    .eq("org_id", orgId)
    .gte(field, start)
    .lte(field, end)
    .order(field, { ascending: false })
    .limit(20);
  return rowsOf(res) as unknown as JobRow[];
}

function countyOf(job: JobRow) {
  const hay = `${job.jurisdiction ?? ""} ${job.city ?? ""}`.toLowerCase();
  if (/miami|dade|hialeah|homestead|doral|kendall|aventura/.test(hay)) return "Miami-Dade";
  if (/broward|pembroke|hollywood|miramar|davie|sunrise|plantation|weston|coral springs|pompano|deerfield|tamarac|margate|coconut creek/.test(hay))
    return "Broward";
  if (/palm beach|boca|delray|boynton|wellington|jupiter|lake worth|west palm/.test(hay)) return "Palm Beach";
  return null;
}

function formatJob(job: JobRow, extra: string[]) {
  const review = dayLabel(job.submitted_date, job.approved_date);
  const sinceSub = !job.approved_date ? dayLabel(job.submitted_date) : null;
  const sinceAssign = dayLabel(job.assigned_date, job.submitted_date ?? undefined);
  const lines = [
    `JOB ${job.job_number} — ${job.client_name}`,
    [job.address, job.city].filter(Boolean).join(", ") || null,
    job.jurisdiction ? `City/jurisdiction: ${job.jurisdiction}` : null,
    job.trade_type ? `Trade: ${job.trade_type}` : null,
    `Permit status: ${job.sub_status}`,
    `Job status: ${job.stage}`,
    job.permit_number ? `Permit #: ${job.permit_number}` : "Permit #: none yet",
    `Permit tech: ${job.permit_tech || "unassigned"}`,
    `Assigned ${md(job.assigned_date)} · Submitted ${md(job.submitted_date)} · Approved ${md(job.approved_date)}`,
    `Ordered ${md(job.ordered_date)} · Expected in ${md(job.material_eta)}`,
    sinceAssign ? `Assign → submit: ${sinceAssign}` : null,
    review ? `Submit → approve: ${review}` : sinceSub ? `In review: ${sinceSub}` : null,
    job.notes ? `Job notes: ${job.notes}` : null,
    ...extra,
  ];
  return lines.filter(Boolean).join("\n");
}

/**
 * One search for every desk and both specialists.
 * Dates come from the job date columns. Notes are never parsed for dates.
 * The jurisdiction line cites the Cycle Time report's cycleDays/average.
 */
export async function searchPermitAio(
  supabase: AnyClient,
  orgId: string,
  query: string,
  desk: ChatDesk,
): Promise<SearchFacts> {
  const q = query.trim().slice(0, 400);
  const sources: SearchSource[] = [...SEARCH_SOURCES];
  if (q.length < 2) {
    return { text: "", jobCount: 0, spoken: emptyAnswer(desk === "hoa" ? "hoa" : "general"), empty: true, sources };
  }

  const today = todayIsoET();
  const window = weekWindow(today);
  const fields = weekFields(q);
  const tokens = jobTokens(q);
  const pattern = like(q.slice(0, 80));
  const blocks: string[] = [];
  let spoken = "";

  let jobs: JobRow[] = [];
  if (fields) {
    const dated: JobRow[] = [];
    const sentences: string[] = [];
    for (const field of fields) {
      const found = await jobsByDates(supabase, orgId, field, window.start, window.end);
      for (const row of found) if (!dated.some((d) => d.id === row.id)) dated.push(row);
      const stamped = found
        .map((row) => ({
          job_number: row.job_number,
          client_name: row.client_name,
          date: String(row[field] ?? "").slice(0, 10),
        }))
        .filter((row) => inWindow(row.date, window));
      sentences.push(spokenWeek(field, stamped));
      blocks.push(
        stamped.length
          ? `DATE FIELD ${field} from ${window.start} through ${window.end}:\n${stamped.map((r) => `${r.job_number} ${r.client_name} ${r.date}`).join("\n")}`
          : `DATE FIELD ${field}: none from ${window.start} through ${window.end}.`,
      );
    }
    spoken = sentences.join(" ");
    jobs = dated.slice(0, 6);
  }

  if (!jobs.length) jobs = await findJobs(supabase, orgId, q, tokens);

  for (const job of jobs.slice(0, 4)) {
    const extra: string[] = [];
    const [hoaRes, activityRes, scoutRes] = await Promise.all([
      supabase
        .from("hoa_jobs")
        .select("status, assigned_to, assigned_date, date_submitted, date_approved, notes, job_name, hoa_id")
        .eq("org_id", orgId)
        .eq("job_id", job.id)
        .maybeSingle(),
      supabase
        .from("job_activity")
        .select("message, created_at")
        .eq("org_id", orgId)
        .eq("job_id", job.id)
        .order("created_at", { ascending: false })
        .limit(8),
      table(supabase, "hoa_scout_findings")
        .select("association, note, observed_on, source_url")
        .eq("org_id", orgId)
        .eq("job_id", job.id)
        .order("created_at", { ascending: false })
        .limit(4),
    ]);
    const hoa = hoaRes.error ? null : hoaRes.data;
    if (hoa) {
      extra.push(
        `HOA TRACKER: status ${hoa.status ?? "none"} · assigned ${md(hoa.assigned_date)} · submitted ${md(hoa.date_submitted)} · approved ${md(hoa.date_approved)}`,
      );
      extra.push(`HOA tech: ${job.hoa_tech || hoa.assigned_to || "unassigned"}`);
      if (hoa.notes) extra.push(`HOA job notes: ${hoa.notes}`);
      if (hoa.hoa_id) {
        const orgHoa = await supabase
          .from("hoas")
          .select("name, contact_name, phone, email, mgmt_co, notes, qualifications")
          .eq("org_id", orgId)
          .eq("id", hoa.hoa_id)
          .maybeSingle();
        const h = orgHoa.data;
        if (h) {
          extra.push(`HOA: ${h.name}${h.mgmt_co ? ` · ${h.mgmt_co}` : ""}`);
          extra.push(`HOA contact: ${h.contact_name || "—"} · ${h.phone || "—"} · ${h.email || "—"}`);
          if (h.notes) extra.push(`HOA company notes: ${h.notes}`);
          if (h.qualifications) extra.push(`HOA guidelines: ${h.qualifications}`);
          if ((desk === "hoa" && isHoaDurationAsk(q)) || isHoaDurationAsk(q)) {
            const history = await supabase
              .from("hoa_jobs")
              .select("date_submitted, date_approved")
              .eq("org_id", orgId)
              .eq("hoa_id", hoa.hoa_id)
              .not("date_submitted", "is", null)
              .not("date_approved", "is", null)
              .limit(40);
            const samples = rowsOf(history)
              .map((row) => {
                const span = cycleDays(String(row.date_submitted ?? ""), String(row.date_approved ?? ""));
                if (span == null) return null;
                return { days: span, approvedOn: String(row.date_approved).slice(0, 10) };
              })
              .filter((row): row is { days: number; approvedOn: string } => Boolean(row));
            const turn = hoaTurnaround(samples, today);
            extra.push(`HOA HISTORY: ${turn.text}`);
            if (!spoken) spoken = turn.text;
          }
        }
      }
    } else if (!hoaRes.error) {
      extra.push("HOA TRACKER: none on file for this job");
    }
    for (const finding of rowsOf(scoutRes)) {
      extra.push(
        `HOA SCOUT ${finding.observed_on ? String(finding.observed_on).slice(0, 10) : ""}: ${finding.association ? `${finding.association} — ` : ""}${finding.note}`,
      );
    }
    for (const note of rowsOf(activityRes)) {
      const created = note.created_at ? String(note.created_at) : "";
      extra.push(`Note ${created || md(String(note.created_at ?? ""))}: ${note.message}`);
    }
    blocks.push(formatJob(job, extra));
  }

  if (!spoken && jobs.length && (desk === "main" || desk === "permit")) {
    spoken = spokenJobs(jobs);
  }

  const jurisdiction = jobs.map((j) => j.jurisdiction).find(Boolean) ?? null;
  if (jurisdiction) {
    const cityJobs = await supabase
      .from("jobs")
      .select("jurisdiction, submitted_date, approved_date")
      .eq("org_id", orgId)
      .ilike("jurisdiction", jurisdiction)
      .limit(300);
    const samples: number[] = [];
    for (const row of rowsOf(cityJobs)) {
      if (canonicalJurisdiction(String(row.jurisdiction ?? "")) !== canonicalJurisdiction(jurisdiction) && String(row.jurisdiction ?? "") !== jurisdiction) {
        continue;
      }
      const span = cycleDays(
        row.submitted_date ? String(row.submitted_date) : null,
        row.approved_date ? String(row.approved_date) : null,
      );
      if (span != null) samples.push(span);
    }
    blocks.push(formatTimeframeLine(jurisdiction, average(samples), samples.length));
  }

  if (q.length >= 3 || jurisdiction) {
    const cityPattern = jurisdiction ? like(jurisdiction) : pattern;
    const [noas, forms, requirements, packets, corrections, lessons, reports, contractors] = await Promise.all([
      supabase
        .from("noa_library")
        .select("manufacturer, noa_number, series, model_number, trade, notes, expiration_date")
        .eq("org_id", orgId)
        .or(`manufacturer.ilike.${pattern},noa_number.ilike.${pattern},series.ilike.${pattern},model_number.ilike.${pattern}`)
        .limit(6),
      supabase
        .from("form_templates")
        .select("title, county, jurisdiction_name, trade, description")
        .or(`title.ilike.${pattern},county.ilike.${pattern},jurisdiction_name.ilike.${pattern}`)
        .limit(6),
      supabase
        .from("requirements_forms")
        .select("jurisdiction, title, notes, county")
        .eq("org_id", orgId)
        .or(`title.ilike.${pattern},jurisdiction.ilike.${cityPattern},county.ilike.${pattern}`)
        .limit(6),
      table(supabase, "platform_registration_packets")
        .select(
          "jurisdiction, county, building_department, building_dept_email, instructions, noc_subject, noc_body, public_portal_url, noc_route, noc_route_target",
        )
        .or(`jurisdiction.ilike.${cityPattern},county.ilike.${pattern},building_department.ilike.${pattern}`)
        .limit(4),
      table(supabase, "corrections_library")
        .select("jurisdiction, correction, resolution, job_number, cross_ref, original_submission, approval_ground_truth, scope, version, status")
        .eq("org_id", orgId)
        .eq("status", "published")
        .limit(12),
      table(supabase, "permit_correction_lessons")
        .select("job_number, jurisdiction, trade, asked, cleared, file_name, created_at")
        .eq("org_id", orgId)
        .limit(desk === "corrections" ? 20 : 8),
      table(supabase, "research_reports")
        .select("agent, county, jurisdiction, title, body, created_at")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false })
        .limit(6),
      supabase
        .from("contractor_profiles")
        .select("company_name, trade, license_number, qualifier_name, contact_name, phone, email, city, is_default")
        .eq("org_id", orgId)
        .limit(6),
    ]);

    let packetRows = rowsOf(packets);
    if (packets.error) {
      const fallback = await table(supabase, "platform_registration_packets")
        .select("jurisdiction, county, building_department, building_dept_email, instructions, noc_subject, noc_body")
        .or(`jurisdiction.ilike.${cityPattern},county.ilike.${pattern},building_department.ilike.${pattern}`)
        .limit(4);
      packetRows = rowsOf(fallback);
    }

    for (const n of rowsOf(noas)) {
      blocks.push(
        `NOA LIBRARY: ${n.manufacturer ?? ""} ${n.noa_number ?? ""}${n.series ? ` · ${n.series}` : ""}${n.expiration_date ? ` · exp ${md(String(n.expiration_date))}` : ""}${n.notes ? `\n${n.notes}` : ""}`,
      );
    }
    for (const f of rowsOf(forms)) {
      blocks.push(`FORMS LIBRARY: ${f.title} · ${f.county ?? ""}${f.jurisdiction_name ? ` / ${f.jurisdiction_name}` : ""}${f.trade ? ` · ${f.trade}` : ""}`);
    }
    for (const f of rowsOf(requirements)) {
      blocks.push(`BUILDING REQUIREMENT: ${f.title} · ${f.jurisdiction ?? ""}${f.county ? ` (${f.county})` : ""}${f.notes ? `\n${f.notes}` : ""}`);
    }
    for (const p of packetRows) {
      const route = p.noc_route ? `${p.noc_route}: ${p.noc_route_target || "target not on file"}` : "not on file";
      blocks.push(
        [
          `BUILDING DEPARTMENT: ${p.jurisdiction}${p.county ? ` (${p.county})` : ""}`,
          p.building_department ? `Department: ${p.building_department}` : null,
          p.building_dept_email ? `Email: ${p.building_dept_email}` : null,
          `NOC ROUTING: ${route}`,
          p.public_portal_url ? `Public portal: ${p.public_portal_url}` : "Public portal: not on file",
          p.instructions ? `Submittal instructions: ${p.instructions}` : null,
        ]
          .filter(Boolean)
          .join("\n"),
      );
    }
    for (const lesson of rowsOf(corrections)) {
      const hay = `${lesson.jurisdiction ?? ""} ${lesson.correction ?? ""} ${lesson.job_number ?? ""}`.toLowerCase();
      const city = (jurisdiction ?? "").toLowerCase();
      const wantAll = desk === "corrections" || /correct/.test(q.toLowerCase());
      const queryHit = q
        .toLowerCase()
        .split(/\s+/)
        .some((word) => word.length > 3 && hay.includes(word));
      if (!wantAll && city && !hay.includes(city) && !queryHit) continue;
      blocks.push(
        [
          `CORRECTIONS LIBRARY v${lesson.version ?? 1} · ${lesson.scope === "jurisdiction" ? "jurisdiction lesson" : "this job"} · ${lesson.jurisdiction || "city not tagged"}${lesson.job_number ? ` · job ${lesson.job_number}` : ""}`,
          `Correction: ${lesson.correction}`,
          lesson.resolution ? `Resolved: ${lesson.resolution}` : "Resolved: not on file",
          lesson.cross_ref ? `Cross-reference: ${lesson.cross_ref}` : null,
          lesson.original_submission ? `Original submission: ${lesson.original_submission}` : null,
          lesson.approval_ground_truth ? `Approval letter: ${lesson.approval_ground_truth}` : null,
        ]
          .filter(Boolean)
          .join("\n"),
      );
    }
    for (const lesson of rowsOf(lessons)) {
      blocks.push(
        [
          `CORRECTION ON FILE · ${lesson.jurisdiction || "city unknown"}${lesson.job_number ? ` · job ${lesson.job_number}` : ""}`,
          `City asked: ${lesson.asked}`,
          lesson.cleared ? `What cleared it: ${lesson.cleared}` : "What cleared it: not recorded yet",
        ]
          .filter(Boolean)
          .join("\n"),
      );
    }
    const countyHint = jobs.map(countyOf).find(Boolean) ?? null;
    if (isHowToQuery(q)) {
      for (const r of matchSeedReports(q, countyHint).slice(0, 2)) {
        blocks.push(
          `RESEARCH REPORT · ${r.agent === "investigator" ? "Investigator" : "Permit Form Specialist"}${r.jurisdiction ? ` · ${r.jurisdiction}` : ""}\n${r.title}\n${r.body}`,
        );
      }
    }
    const wantResearch = isHowToQuery(q) || desk === "permit" || desk === "corrections";
    for (const r of wantResearch ? rowsOf(reports).slice(0, 3) : []) {
      const city = (jurisdiction ?? "").toLowerCase();
      const hay = `${r.county ?? ""} ${r.jurisdiction ?? ""} ${r.title ?? ""}`.toLowerCase();
      if (city && !hay.includes(city) && !isHowToQuery(q)) continue;
      blocks.push(
        `RESEARCH REPORT · ${r.agent === "investigator" ? "Investigator" : "Permit Form Specialist"}${r.jurisdiction ? ` · ${r.jurisdiction}` : ""}${r.county ? ` (${r.county})` : ""}\n${r.title}\n${String(r.body ?? "").slice(0, 700)}`,
      );
    }
    for (const c of rowsOf(contractors)) {
      blocks.push(
        `CONTRACTOR REGISTRATION: ${c.company_name}${c.is_default ? " (default)" : ""} · ${c.trade || "trade not set"}${c.license_number ? ` · license ${c.license_number}` : ""}${c.qualifier_name ? ` · qualifier ${c.qualifier_name}` : ""} · ${c.phone || "no phone"} · ${c.email || "no email"}`,
      );
    }
  }

  if (q.length >= 3 && (desk === "hoa" || desk === "main" || desk === "corrections")) {
    const [spine, orgHoas, scout] = await Promise.all([
      table(supabase, "hoa_spine")
        .select("name, city, contact_name, phone, email, mgmt_co, notes, qualifications")
        .or(`name.ilike.${pattern},city.ilike.${pattern},mgmt_co.ilike.${pattern}`)
        .limit(4),
      supabase.from("hoas").select("id, name, contact_name, phone, email, mgmt_co, notes, qualifications").eq("org_id", orgId).ilike("name", pattern).limit(4),
      table(supabase, "hoa_scout_findings")
        .select("association, note, observed_on")
        .eq("org_id", orgId)
        .ilike("association", pattern)
        .limit(4),
    ]);
    for (const s of rowsOf(spine)) {
      blocks.push(`HOA DIRECTORY: ${s.name}${s.city ? ` (${s.city})` : ""} · ${s.phone || "—"} · ${s.email || "—"}`);
    }
    for (const h of rowsOf(orgHoas)) {
      blocks.push(`HOA (this company): ${h.name} · ${h.phone || "—"} · ${h.email || "—"}`);
    }
    for (const s of rowsOf(scout)) {
      blocks.push(`HOA SCOUT ${s.observed_on ? String(s.observed_on).slice(0, 10) : ""}: ${s.association} — ${s.note}`);
    }
    if (isHoaDurationAsk(q) && !/HOA HISTORY/.test(blocks.join("\n"))) {
      const hoa = rowsOf(orgHoas)[0];
      let samples: { days: number; approvedOn: string }[] = [];
      if (hoa?.id) {
        const history = await supabase
          .from("hoa_jobs")
          .select("date_submitted, date_approved")
          .eq("org_id", orgId)
          .eq("hoa_id", hoa.id)
          .not("date_submitted", "is", null)
          .not("date_approved", "is", null)
          .limit(40);
        samples = rowsOf(history)
          .map((row) => {
            const span = cycleDays(row.date_submitted ? String(row.date_submitted) : null, row.date_approved ? String(row.date_approved) : null);
            if (span == null || !row.date_approved) return null;
            return { days: span, approvedOn: String(row.date_approved).slice(0, 10) };
          })
          .filter((row): row is { days: number; approvedOn: string } => Boolean(row));
      }
      const turn = hoaTurnaround(samples, today);
      spoken = turn.text;
      blocks.push(`HOA HISTORY: ${turn.text}`);
    }
  }

  const text = blocks.join("\n\n").slice(0, 14000);
  const empty = !text.trim();
  if (!spoken) {
    spoken = empty ? emptyAnswer(desk === "hoa" ? "hoa" : desk === "support" ? "general" : "permit") : "";
  }
  const withSpoken = spoken ? `SPOKEN ANSWER (say it this way — no table, no bullet list):\n${spoken}` : "";
  return {
    text: [withSpoken, text].filter(Boolean).join("\n\n").slice(0, 14000),
    jobCount: jobs.length,
    spoken,
    empty,
    sources,
  };
}
