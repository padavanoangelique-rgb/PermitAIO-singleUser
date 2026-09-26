/**
 * Semantic retrieval for Ask PermitAIO.
 * Jobs / week / scout stay exact via searchPermitAio.
 * Org libraries load broadly (no keyword gate), then rank by embedding / TF-IDF.
 * empty only when zero corpus/job text remains.
 */
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChatDesk } from "./bots";
import { rankFactChunks, type FactChunk } from "./embeddings";
import { searchPermitAio, type SearchFacts } from "./search";

type AnyClient = SupabaseClient<any, any, any>;

export type RetrieveFacts = SearchFacts & {
  retrievalPath: string;
  retrievalNote: string;
};

function table(supabase: AnyClient, name: string) {
  return (supabase as unknown as { from: (t: string) => any }).from(name);
}

function rowsOf(result: { data?: unknown; error?: { message?: string } | null }) {
  if (result?.error || !result?.data) return [];
  return (Array.isArray(result.data) ? result.data : [result.data]) as Record<string, unknown>[];
}

function pushChunk(chunks: FactChunk[], id: string, source: string, text: string, alwaysInclude = false) {
  const t = text.trim();
  if (!t) return;
  chunks.push({ id, source, text: t, alwaysInclude });
}

/** Broad org corpus — no keyword gate. Caps keep the pool ~40–80 chunks. */
async function loadBroadCorpus(
  supabase: AnyClient,
  orgId: string,
  desk: ChatDesk,
): Promise<FactChunk[]> {
  const chunks: FactChunk[] = [];
  let n = 0;
  const id = (p: string) => `${p}-${++n}`;

  const [
    noas, forms, requirements, packets, corrections, lessons, reports, contractors, spine, orgHoas, scout,
  ] = await Promise.all([
    supabase.from("noa_library").select("manufacturer, noa_number, series, notes, expiration_date").eq("org_id", orgId).order("expiration_date", { ascending: false, nullsFirst: false }).limit(12),
    supabase.from("form_templates").select("title, county, jurisdiction_name, trade, description").limit(16),
    supabase.from("requirements_forms").select("jurisdiction, title, notes, county").eq("org_id", orgId).limit(16),
    table(supabase, "platform_registration_packets").select("jurisdiction, county, building_department, building_dept_email, instructions, public_portal_url, noc_route, noc_route_target").limit(12),
    table(supabase, "corrections_library").select("jurisdiction, correction, resolution, job_number, cross_ref, original_submission, approval_ground_truth, scope, version, status").eq("org_id", orgId).eq("status", "published").limit(24),
    table(supabase, "permit_correction_lessons").select("job_number, jurisdiction, asked, cleared").eq("org_id", orgId).order("created_at", { ascending: false }).limit(desk === "corrections" ? 20 : 12),
    table(supabase, "research_reports").select("agent, county, jurisdiction, title, body").eq("org_id", orgId).order("created_at", { ascending: false }).limit(12),
    supabase.from("contractor_profiles").select("company_name, trade, license_number, qualifier_name, phone, email, is_default").eq("org_id", orgId).limit(8),
    table(supabase, "hoa_spine").select("name, city, phone, email, notes, qualifications").limit(12),
    supabase.from("hoas").select("name, phone, email, notes, qualifications").eq("org_id", orgId).limit(12),
    table(supabase, "hoa_scout_findings").select("association, note, observed_on").eq("org_id", orgId).order("created_at", { ascending: false }).limit(12),
  ]);

  let packetRows = rowsOf(packets);
  if (packets.error) {
    packetRows = rowsOf(await table(supabase, "platform_registration_packets").select("jurisdiction, county, building_department, building_dept_email, instructions").limit(12));
  }

  for (const r of rowsOf(noas)) {
    pushChunk(chunks, id("noa"), "noa_library", `NOA LIBRARY: ${r.manufacturer ?? ""} ${r.noa_number ?? ""}${r.series ? ` · ${r.series}` : ""}${r.notes ? `\n${r.notes}` : ""}`);
  }
  for (const r of rowsOf(forms)) {
    pushChunk(chunks, id("form"), "forms_library", `FORMS LIBRARY: ${r.title} · ${r.county ?? ""}${r.jurisdiction_name ? ` / ${r.jurisdiction_name}` : ""}${r.description ? `\n${r.description}` : ""}`);
  }
  for (const r of rowsOf(requirements)) {
    pushChunk(chunks, id("req"), "building_department", `BUILDING REQUIREMENT: ${r.title} · ${r.jurisdiction ?? ""}${r.notes ? `\n${r.notes}` : ""}`);
  }
  for (const p of packetRows.slice(0, 10)) {
    const route = p.noc_route ? `${p.noc_route}: ${p.noc_route_target || "target not on file"}` : "not on file";
    pushChunk(chunks, id("packet"), "building_department", [`BUILDING DEPARTMENT: ${p.jurisdiction}${p.county ? ` (${p.county})` : ""}`, p.building_department ? `Department: ${p.building_department}` : null, `NOC ROUTING: ${route}`, p.instructions ? `Submittal: ${p.instructions}` : null].filter(Boolean).join("\n"));
  }
  for (const lesson of rowsOf(corrections)) {
    pushChunk(chunks, id("corr"), "corrections_library", [`CORRECTIONS LIBRARY v${lesson.version ?? 1} · ${lesson.jurisdiction || "city not tagged"}${lesson.job_number ? ` · job ${lesson.job_number}` : ""}`, `Correction: ${lesson.correction}`, lesson.resolution ? `Resolved: ${lesson.resolution}` : null].filter(Boolean).join("\n"));
  }
  for (const lesson of rowsOf(lessons)) {
    pushChunk(chunks, id("lesson"), "corrections_library", [`CORRECTION ON FILE · ${lesson.jurisdiction || "city unknown"}${lesson.job_number ? ` · job ${lesson.job_number}` : ""}`, `City asked: ${lesson.asked}`, lesson.cleared ? `Cleared: ${lesson.cleared}` : null].filter(Boolean).join("\n"));
  }
  for (const r of rowsOf(reports)) {
    pushChunk(chunks, id("report"), "research_reports", `RESEARCH REPORT · ${r.agent === "investigator" ? "Investigator" : "Form Specialist"}${r.jurisdiction ? ` · ${r.jurisdiction}` : ""}\n${r.title}\n${String(r.body ?? "").slice(0, 900)}`);
  }
  for (const c of rowsOf(contractors)) {
    pushChunk(chunks, id("contractor"), "contractor_registration", `CONTRACTOR: ${c.company_name}${c.is_default ? " (default)" : ""} · ${c.trade || "trade not set"} · ${c.phone || "no phone"}`);
  }
  for (const s of rowsOf(spine)) {
    pushChunk(chunks, id("hoa-spine"), "hoa_scout", `HOA DIRECTORY: ${s.name}${s.city ? ` (${s.city})` : ""} · ${s.phone || "—"} · ${s.email || "—"}${s.notes ? `\n${s.notes}` : ""}`);
  }
  for (const h of rowsOf(orgHoas)) {
    pushChunk(chunks, id("hoa-org"), "hoa_tracker", `HOA (this company): ${h.name} · ${h.phone || "—"} · ${h.email || "—"}${h.notes ? `\n${h.notes}` : ""}`);
  }
  for (const s of rowsOf(scout)) {
    pushChunk(chunks, id("hoa-scout"), "hoa_scout", `HOA SCOUT ${s.observed_on ? String(s.observed_on).slice(0, 10) : ""}: ${s.association} — ${s.note}`);
  }
  return chunks.slice(0, 80);
}

function splitStructured(text: string): FactChunk[] {
  const chunks: FactChunk[] = [];
  let i = 0;
  for (const part of text.split(/\n\n+/).map((p) => p.trim()).filter(Boolean)) {
    const always = /^(SPOKEN ANSWER|JOB |DATE FIELD|JURISDICTION TIMEFRAME|HOA TRACKER|HOA HISTORY|HOA SCOUT|Note )/i.test(part);
    chunks.push({ id: `structured-${++i}`, source: "structured", text: part, alwaysInclude: always });
  }
  return chunks;
}

export async function retrievePermitAio(
  supabase: AnyClient,
  orgId: string,
  query: string,
  desk: ChatDesk,
): Promise<RetrieveFacts> {
  const base = await searchPermitAio(supabase, orgId, query, desk);
  const structured = splitStructured(base.text);
  let corpus: FactChunk[] = [];
  try {
    corpus = await loadBroadCorpus(supabase, orgId, desk);
  } catch (err) {
    console.error("broad corpus load failed", err);
  }

  const seen = new Set<string>();
  const pool: FactChunk[] = [];
  for (const c of [...structured, ...corpus]) {
    const key = c.text.slice(0, 160);
    if (seen.has(key)) continue;
    seen.add(key);
    pool.push(c);
  }

  const { ranked, path, note } = await rankFactChunks(query, pool, 16);
  const body = ranked.map((c) => c.text).join("\n\n").slice(0, 14000);
  const empty = !body.trim();
  const spoken = base.spoken;
  const withSpoken = spoken && !body.includes(spoken)
    ? `SPOKEN ANSWER (say it this way — no table, no bullet list):\n${spoken}`
    : "";
  return {
    text: [`RETRIEVAL: ${path} — ${note}`, withSpoken, body].filter(Boolean).join("\n\n").slice(0, 14000),
    jobCount: base.jobCount,
    spoken,
    empty,
    sources: base.sources,
    retrievalPath: path,
    retrievalNote: note,
  };
}
