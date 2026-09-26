/** Pure rules shared by every desk. No database. No org names. */

export const SEARCH_SOURCES = [
  "jobs",
  "notes",
  "dates",
  "corrections_library",
  "noa_library",
  "forms_library",
  "building_department",
  "jurisdiction_timeframe",
  "contractor_registration",
  "noc_routing",
  "hoa_tracker",
  "hoa_scout",
  "research_reports",
  "permit_scout_notes",
] as const;

export type SearchSource = (typeof SEARCH_SOURCES)[number];

export type DateField =
  | "approved_date"
  | "submitted_date"
  | "assigned_date"
  | "ordered_date"
  | "material_eta";

export type ScoutStatus = "approved" | "payment" | "corrections" | "mentioned" | "not_on_page" | "no_portal";

export type LibraryEntryInput = {
  jurisdiction?: string | null;
  correction?: string | null;
  resolution?: string | null;
  job_number?: string | null;
  scope?: "job" | "jurisdiction" | string | null;
  approval_ground_truth?: string | null;
};

const GUESS = /\b(i think|probably|typically takes|usually takes|should be about)\b/i;

export function addDays(isoDate: string, days: number) {
  const [y, m, d] = isoDate.slice(0, 10).split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** Today in Eastern Time, as YYYY-MM-DD. Date fields are calendar dates. */
export function todayIsoET(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** "This week" is today minus 7 days, inclusive, on a structured date column. */
export function weekWindow(todayIso: string) {
  return { start: addDays(todayIso, -7), end: todayIso.slice(0, 10) };
}

export function inWindow(value: string | null | undefined, window: { start: string; end: string }) {
  if (!value) return false;
  const day = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  return day >= window.start && day <= window.end;
}

export function weekFields(text: string): DateField[] | null {
  if (!/\b(this week|last 7 days|past week|last week)\b/i.test(text)) return null;
  const fields: DateField[] = [];
  if (/approv/i.test(text)) fields.push("approved_date");
  if (/submit/i.test(text)) fields.push("submitted_date");
  if (/assign/i.test(text)) fields.push("assigned_date");
  if (/order/i.test(text)) fields.push("ordered_date");
  if (/expected|coming in|eta|expected-in/i.test(text)) fields.push("material_eta");
  if (!fields.length) fields.push("approved_date", "submitted_date");
  return fields;
}

export function dateFieldLabel(field: DateField) {
  switch (field) {
    case "approved_date":
      return "an approved date";
    case "submitted_date":
      return "a submitted date";
    case "assigned_date":
      return "an assigned date";
    case "ordered_date":
      return "an ordered date";
    case "material_eta":
      return "an expected-in date";
  }
}

export function isLiveStatusAsk(text: string) {
  return /\b(live status|check (the )?(portal|status|permit scout)|ask permit scout|pull (the )?portal|what does the (city|portal|building department) (say|show))\b/i.test(
    text,
  );
}

export function isHoaDurationAsk(text: string) {
  return /\b(how long|usually take|turnaround|how many days)\b/i.test(text);
}

export function jobToken(text: string) {
  const labeled = text.match(/\bjob\s*#?\s*([A-Za-z0-9][A-Za-z0-9._-]{1,24})\b/i);
  if (labeled?.[1]) return labeled[1].replace(/[.,;:]+$/, "");
  const hashed = text.match(/#\s*([A-Za-z]{0,4}-?\d{3,}(?:-[A-Za-z0-9]+)?)\b/);
  if (hashed?.[1]) return hashed[1];
  const bare = text.match(/\b(\d{4,}(?:-[A-Za-z0-9]+)?)\b/);
  return bare?.[1] ?? null;
}

export function emptyAnswer(topic: "permit" | "hoa" | "general") {
  if (topic === "hoa") {
    return "I don't have that. The HOA has it. I only repeat what is already in the tracker or in HOA Scout notes.";
  }
  if (topic === "permit") {
    return "I don't have that. The building department has the live record. I only repeat what is on the job or in the library.";
  }
  return "I don't have that. The building department has permit status. The HOA has association records. I won't guess.";
}

export type SpokenJob = {
  job_number: string;
  client_name: string;
  sub_status: string;
  jurisdiction?: string | null;
  permit_number?: string | null;
  submitted_date?: string | null;
  approved_date?: string | null;
  ordered_date?: string | null;
  material_eta?: string | null;
};

export function spokenJob(job: SpokenJob) {
  const place = job.jurisdiction ? ` in ${job.jurisdiction}` : "";
  const permit = job.permit_number
    ? ` Permit number ${job.permit_number} is on file.`
    : " No permit number is on file yet.";
  const when = job.approved_date
    ? ` Approved date ${job.approved_date}.`
    : job.submitted_date
      ? ` Submitted date ${job.submitted_date}.`
      : "";
  const order = job.material_eta
    ? ` Expected in ${job.material_eta}.`
    : job.ordered_date
      ? ` Ordered ${job.ordered_date}.`
      : "";
  return `Job ${job.job_number} for ${job.client_name} is ${job.sub_status}${place}.${permit}${when}${order}`
    .replace(/\s+/g, " ")
    .trim();
}

export function spokenJobs(jobs: SpokenJob[]) {
  if (!jobs.length) return "";
  if (jobs.length === 1) return spokenJob(jobs[0]);
  const head = jobs.slice(0, 2).map(spokenJob).join(" ");
  return `I found ${jobs.length} matches. ${head}`;
}

export function spokenWeek(
  field: DateField,
  rows: { job_number: string; client_name: string; date: string }[],
) {
  const label = dateFieldLabel(field);
  if (!rows.length) {
    return `I don't have any permits with ${label} in the last 7 days. I only count that date on the job, not words in a note.`;
  }
  const bits = rows.slice(0, 5).map((r) => `${r.job_number} ${r.client_name} on ${r.date}`);
  const extra = rows.length > 5 ? ` And ${rows.length - 5} more.` : "";
  return `${rows.length} with ${label} in the last 7 days: ${bits.join("; ")}.${extra}`;
}

export function looksLikeBulletWall(text: string) {
  if (/\|.+\|/.test(text) && /---/.test(text)) return true;
  const bullets = text.split("\n").filter((line) => /^\s*([-*•]|\d+\.)\s+/.test(line)).length;
  return bullets >= 3;
}

export type HoaSample = { days: number; approvedOn: string };

/** Recent approvals (last 180 days) count twice. One row is not a pattern. */
export function hoaTurnaround(samples: HoaSample[], todayIso: string) {
  const clean = samples.filter(
    (s) => Number.isFinite(s.days) && s.days >= 0 && s.days <= 1095 && /^\d{4}-\d{2}-\d{2}/.test(s.approvedOn),
  );
  if (!clean.length) {
    return {
      n: 0,
      text: "I don't have a completed HOA submittal-to-approval on file for this association. I won't guess a usual time.",
    };
  }
  if (clean.length === 1) {
    const one = clean[0];
    return {
      n: 1,
      text: `I have one completed HOA on file: ${one.days} days, approved ${one.approvedOn.slice(0, 10)}. That is one data point, not a usual time.`,
    };
  }
  const recentCut = addDays(todayIso, -180);
  let weighted = 0;
  let weight = 0;
  for (const s of clean) {
    const w = s.approvedOn.slice(0, 10) >= recentCut ? 2 : 1;
    weighted += s.days * w;
    weight += w;
  }
  const avg = Math.round(weighted / weight);
  return {
    n: clean.length,
    text: `Across ${clean.length} completed HOA approvals on file, the recent-weighted average is ${avg} days. Newer approvals count twice. This is history, not a promise.`,
  };
}

/** Same inputs the Cycle Time report already uses. Do not pass a second formula. */
export function formatTimeframeLine(jurisdiction: string, reviewAvg: number | null, samples: number) {
  const city = jurisdiction.trim() || "this jurisdiction";
  if (reviewAvg == null || samples === 0) {
    return `JURISDICTION TIMEFRAME REPORT (${city}): the Cycle Time report has no completed submit-to-approve cycle on file. I will not estimate one.`;
  }
  const avg = Math.round(reviewAvg * 10) / 10;
  const noun = samples === 1 ? "completed approval" : "completed approvals";
  return `JURISDICTION TIMEFRAME REPORT (${city}): Cycle Time report average is ${avg} days from submitted to approved across ${samples} ${noun}. Same cycleDays and average as that report. Not a new calculation.`;
}

export function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export function parsePortalStatus(html: string, permitNumber: string): { status: ScoutStatus; excerpt: string } {
  const permit = permitNumber.trim();
  if (!permit) return { status: "not_on_page", excerpt: "" };
  const text = stripHtml(html);
  const at = text.toLowerCase().indexOf(permit.toLowerCase());
  if (at < 0) return { status: "not_on_page", excerpt: "" };
  const excerpt = text.slice(Math.max(0, at - 180), at + permit.length + 220).trim();
  const hay = excerpt.toLowerCase();
  if (/correction|revise and resubmit|deficiency|comments issued/.test(hay)) {
    return { status: "corrections", excerpt };
  }
  if (/payment due|fees due|balance due|awaiting payment|needs payment|pay fees/.test(hay)) {
    return { status: "payment", excerpt };
  }
  if (/\bapproved\b|\bissued\b|permit issued/.test(hay) && !/not approved|approval pending/.test(hay)) {
    return { status: "approved", excerpt };
  }
  return { status: "mentioned", excerpt };
}

export function shouldNotifyScout(status: ScoutStatus) {
  return status === "approved" || status === "payment" || status === "corrections";
}

export function scoutToken(status: ScoutStatus) {
  return `[permit-scout:${status}]`;
}

export function scoutSentence(status: ScoutStatus, jurisdiction: string) {
  const city = jurisdiction.trim() || "that city";
  switch (status) {
    case "approved":
      return "The public page says approved.";
    case "payment":
      return "The public page says payment is due.";
    case "corrections":
      return "The public page says there are corrections.";
    case "mentioned":
      return "The permit number is on the public page, but it does not say approved, payment due, or corrections. I will not guess the status.";
    case "not_on_page":
      return "I don't have that status. The public page did not show this permit number. The building department has the live record.";
    case "no_portal":
      return `I don't have a public search link for ${city}. The building department has it.`;
  }
}

export function libraryEntryProblems(entry: LibraryEntryInput) {
  const problems: string[] = [];
  const correction = (entry.correction ?? "").trim();
  if (!correction) problems.push("Correction text is empty.");
  if (GUESS.test(correction) || GUESS.test(entry.resolution ?? "")) {
    problems.push("This reads like a guess. Say what was asked and what cleared it. Do not state a pattern.");
  }
  const scope = entry.scope === "jurisdiction" ? "jurisdiction" : "job";
  if (scope === "jurisdiction" && !(entry.jurisdiction ?? "").trim()) {
    problems.push("A jurisdiction lesson needs a jurisdiction tag.");
  }
  if (scope === "job" && !(entry.job_number ?? "").trim()) {
    problems.push("A job correction needs a job number.");
  }
  const truth = (entry.approval_ground_truth ?? "").trim().toLowerCase();
  if (truth === "stamp" || truth === "the stamp" || truth === "approved stamp") {
    problems.push("Approved permit ground truth has to include the conditions on the approval letter, not just the stamp.");
  }
  return problems;
}

export function isInterpretation(kind: string) {
  return kind === "research_report" || kind === "library_correction" || kind === "weekly_self_update";
}

export function isFactWrite(kind: string) {
  return kind === "job_note" || kind === "date_field" || kind === "permit_scout_pull";
}
