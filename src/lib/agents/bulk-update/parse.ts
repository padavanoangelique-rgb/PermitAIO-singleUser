export const BULK_DATE_FIELDS = [
  "assigned_date",
  "submitted_date",
  "approved_date",
  "noc_date",
] as const;

export const BULK_STATUSES = [
  "Need to Submit",
  "Quote Needed",
  "Engineering Pending",
  "In Review",
  "Corrections Needed",
  "Approved",
  "Approved and Printed",
  "Complete",
] as const;

export type BulkDateField = (typeof BULK_DATE_FIELDS)[number];
export type BulkStatus = (typeof BULK_STATUSES)[number];

export type BulkPatch =
  | { kind: "date"; field: BulkDateField; value: string }
  | { kind: "status"; field: "sub_status"; value: BulkStatus };

export type ParsedBulk = {
  isBulk: boolean;
  patch: BulkPatch | null;
  jobNumbers: string[];
  skipped: string[];
  reason: string;
};

const MONTHS: Record<string, string> = {
  january: "01",
  february: "02",
  march: "03",
  april: "04",
  may: "05",
  june: "06",
  july: "07",
  august: "08",
  september: "09",
  october: "10",
  november: "11",
  december: "12",
  jan: "01",
  feb: "02",
  mar: "03",
  apr: "04",
  jun: "06",
  jul: "07",
  aug: "08",
  sep: "09",
  sept: "09",
  oct: "10",
  nov: "11",
  dec: "12",
};

export function isBulkEmail(subject: string, body: string): boolean {
  const text = `${subject}\n${body}`;
  if (/permitaio\/bulk/i.test(text)) return true;
  if (/^bulk update\b/im.test(text)) return true;
  if (/\bBULK UPDATE\b/i.test(text)) return true;
  if (/were assigned on\b/i.test(text)) return true;
  if (/change the assigned date\b/i.test(text)) return true;
  if (/set (the )?assigned date\b/i.test(text)) return true;
  if (/set status to\b/i.test(text) && hasJobToken(text)) return true;
  if (/^FIELD\s*:/im.test(text) && hasJobToken(text)) return true;
  return false;
}

function hasJobToken(text: string): boolean {
  return /\b(?:JOB-|PA-)?\d{3,}(?:-\d+)?\b/i.test(text);
}

function pad2(n: string): string {
  return n.padStart(2, "0");
}

export function parseDate(raw: string): string | null {
  const value = raw.trim().replace(/[.,]/g, " ").replace(/\s+/g, " ");
  const iso = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) return `${iso[1]}-${pad2(iso[2])}-${pad2(iso[3])}`;
  const us = value.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
  if (us) {
    const year = us[3].length === 2 ? `20${us[3]}` : us[3];
    return `${year}-${pad2(us[1])}-${pad2(us[2])}`;
  }
  const named = value.match(/^([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?\s+(\d{4})$/);
  if (named) {
    const month = MONTHS[named[1].toLowerCase()];
    if (!month) return null;
    return `${named[3]}-${month}-${pad2(named[2])}`;
  }
  return null;
}

function parseStatus(raw: string): BulkStatus | null {
  const compact = raw.toLowerCase().replace(/[^a-z]/g, "");
  for (const status of BULK_STATUSES) {
    if (status.toLowerCase().replace(/[^a-z]/g, "") === compact) return status;
  }
  if (compact === "approvedprinted" || compact === "printed") return "Approved and Printed";
  if (compact === "needtosubmit" || compact === "needsubmit") return "Need to Submit";
  if (compact === "corrections" || compact === "correctionneeded") return "Corrections Needed";
  if (compact === "quote" || compact === "needquote") return "Quote Needed";
  if (compact === "engineering" || compact === "engpending") return "Engineering Pending";
  return null;
}

function looksLikeJobNumber(value: string): boolean {
  const token = value.replace(/^#/, "").trim();
  if (token.length < 3 || token.length > 24) return false;
  return /^(?:JOB-|PA-)?[A-Za-z0-9]+(?:-\d+)?$/i.test(token);
}

function collectJobNumbers(text: string, skipped: string[]): string[] {
  const seen = new Set<string>();
  const jobs: string[] = [];

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\s+/g, " ").trim();
    if (!line) continue;
    if (/^(bulk update|field|value|tech|new jobs)\b/i.test(line)) continue;
    if (/were assigned on|change the assigned|set status to|set the assigned/i.test(line)) continue;

    const pipe = line.split("|").map((part) => part.trim());
    if (pipe.length >= 2 && looksLikeJobNumber(pipe[0])) {
      const jobNumber = pipe[0].replace(/^#/, "");
      const key = jobNumber.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      jobs.push(jobNumber);
      continue;
    }

    for (const piece of line.split(/[,;]+/)) {
      const token = piece.replace(/^#/, "").trim();
      if (!looksLikeJobNumber(token)) continue;
      if (!/\d/.test(token)) continue;
      const key = token.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      jobs.push(token);
    }
  }

  if (jobs.length === 0) skipped.push("No job numbers found.");
  return jobs.slice(0, 80);
}

function detectPatch(text: string): BulkPatch | null {
  const fieldLine = text.match(/^FIELD\s*:\s*([a-z_ ]+)$/im);
  const valueLine = text.match(/^VALUE\s*:\s*(.+)$/im);

  if (fieldLine && valueLine) {
    const field = fieldLine[1].trim().toLowerCase().replace(/\s+/g, "_");
    if ((BULK_DATE_FIELDS as readonly string[]).includes(field)) {
      const date = parseDate(valueLine[1]);
      if (!date) return null;
      return { kind: "date", field: field as BulkDateField, value: date };
    }
    if (field === "sub_status" || field === "status") {
      const status = parseStatus(valueLine[1]);
      if (!status) return null;
      return { kind: "status", field: "sub_status", value: status };
    }
  }

  const assigned =
    text.match(/assigned(?: date)?(?: on| to|:)?\s+(.+)/i) ||
    text.match(/change the assigned date(?: on all jobs)?(?: to|:)?\s*(.+)/i);
  if (assigned) {
    const date = parseDate(assigned[1].split(/\n/)[0]);
    if (date) return { kind: "date", field: "assigned_date", value: date };
  }

  const submitted = text.match(/submitted(?: date)?(?: on| to|:)?\s+(.+)/i);
  if (submitted) {
    const date = parseDate(submitted[1].split(/\n/)[0]);
    if (date) return { kind: "date", field: "submitted_date", value: date };
  }

  const approved = text.match(/approved(?: date)?(?: on| to|:)?\s+(.+)/i);
  if (approved) {
    const date = parseDate(approved[1].split(/\n/)[0]);
    if (date) return { kind: "date", field: "approved_date", value: date };
  }

  const statusMatch = text.match(/set status to\s+([A-Za-z][A-Za-z ]+)/i);
  if (statusMatch) {
    const status = parseStatus(statusMatch[1]);
    if (status) return { kind: "status", field: "sub_status", value: status };
  }

  return null;
}

export function parseBulkEmail(subject: string, body: string): ParsedBulk {
  const text = `${subject}\n${body}`;
  if (!isBulkEmail(subject, body)) {
    return { isBulk: false, patch: null, jobNumbers: [], skipped: [], reason: "Not a bulk update." };
  }

  const skipped: string[] = [];
  if (/\ball jobs\b/i.test(text) && !hasJobToken(text)) {
    return {
      isBulk: true,
      patch: null,
      jobNumbers: [],
      skipped: ["Refused: 'all jobs' with no job numbers."],
      reason: "List the job numbers. The bulk agent will not touch the whole queue.",
    };
  }

  const patch = detectPatch(text);
  const jobNumbers = collectJobNumbers(text, skipped);

  if (!patch) {
    return {
      isBulk: true,
      patch: null,
      jobNumbers,
      skipped,
      reason: "Could not read the field and value. Use FIELD: assigned_date and VALUE: 2026-09-10.",
    };
  }

  if (jobNumbers.length === 0) {
    return {
      isBulk: true,
      patch,
      jobNumbers: [],
      skipped,
      reason: "No job numbers to update.",
    };
  }

  return {
    isBulk: true,
    patch,
    jobNumbers,
    skipped,
    reason: `Update ${patch.field} to ${patch.value} on ${jobNumbers.length} job(s).`,
  };
}
