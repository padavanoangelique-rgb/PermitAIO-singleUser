import type { Tables, TablesInsert, TablesUpdate } from "@/lib/supabase/types";
import { HOA_JOB_STATUSES } from "./constants";

type HoaJob = Tables<"hoa_jobs">;

export type CsvRecord = Record<string, string>;

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else {
      cell += ch;
    }
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

export function csvRecords(text: string): CsvRecord[] {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((cells) => {
    const obj: CsvRecord = {};
    headers.forEach((h, i) => {
      obj[h] = (cells[i] ?? "").trim();
    });
    return obj;
  });
}

// Case-insensitive column lookup — the reference tool's CSV columns are
// camelCase (mgmtCo, contactName, hoaName, jobNumber, ...); accept those
// verbatim plus a couple of common variants so real-world exports still work.
function pick(row: CsvRecord, ...names: string[]): string {
  for (const name of names) {
    for (const key of Object.keys(row)) {
      if (key.toLowerCase() === name.toLowerCase()) return row[key];
    }
  }
  return "";
}

export interface HoaImportResult {
  row: TablesInsert<"hoas"> | null;
  skipped: boolean;
  reason?: string;
}

// Mirrors the reference app's CSV mode "hoa": columns are
// name, mgmtCo, contactName, phone, email, address, qualifications, notes.
// Existing HOAs (matched by name, case-insensitive) are skipped.
export function mapHoaImportRows(
  records: CsvRecord[],
  orgId: string,
  existingNames: string[],
): HoaImportResult[] {
  const existing = new Set(existingNames.map((n) => n.toLowerCase()));
  const seenThisImport = new Set<string>();
  return records.map((row) => {
    const name = pick(row, "name").trim();
    if (!name) return { row: null, skipped: true, reason: "missing name" };
    const key = name.toLowerCase();
    if (existing.has(key) || seenThisImport.has(key)) {
      return { row: null, skipped: true, reason: "duplicate name" };
    }
    seenThisImport.add(key);
    return {
      row: {
        org_id: orgId,
        name,
        mgmt_co: pick(row, "mgmtCo") || "",
        contact_name: pick(row, "contactName") || "",
        phone: pick(row, "phone") || "",
        email: pick(row, "email") || "",
        address: pick(row, "address") || "",
        qualifications: pick(row, "qualifications") || "",
        notes: pick(row, "notes") || "",
      },
      skipped: false,
    };
  });
}

export interface HoaJobImportResult {
  row: TablesInsert<"hoa_jobs"> | null;
  skipped: boolean;
  reason?: string;
  linked?: boolean;
}

// Mirrors the reference app's CSV mode "job": columns are
// hoaName, jobNumber, jobName, address, status, assignedTo, assignedDate,
// dateSubmitted, dateApproved, notes. hoaName must match an existing HOA
// (case-insensitive); assignedTo should be Tech 1, Tech 2, or Tech 3.
//
// Auto-linking: when a row's jobNumber matches an existing Permit Inventory
// job (case-insensitive, trimmed) for this org, the new hoa_jobs row is
// attached to that job via job_id — so it shows up on the job's HOA tab in
// the Job Hub instead of only existing as a standalone HOA Tracker entry.
// A job_id can only ever back one hoa_jobs row (enforced here, not by a DB
// constraint), so a job that's already linked — either from a prior import
// or an earlier row in this same file — is imported unlinked (job_id left
// null) rather than creating a second row that would break the single-link
// lookup used elsewhere in the app.
export function mapHoaJobImportRows(
  records: CsvRecord[],
  orgId: string,
  hoas: { id: string; name: string }[],
  jobs: { id: string; job_number: string }[] = [],
  alreadyLinkedJobIds: Iterable<string> = [],
): HoaJobImportResult[] {
  const jobsByNumber = new Map(jobs.map((j) => [j.job_number.trim().toLowerCase(), j.id]));
  const linkedJobIds = new Set(alreadyLinkedJobIds);
  return records.map((row) => {
    const hoaName = pick(row, "hoaName").trim();
    const address = pick(row, "address").trim();
    const hoa = hoas.find((h) => h.name.toLowerCase() === hoaName.toLowerCase());
    if (!hoa || !address) {
      return { row: null, skipped: true, reason: !hoa ? "HOA not found" : "missing address" };
    }
    const status = pick(row, "status");
    const jobNumber = pick(row, "jobNumber") || "";
    const matchedJobId = jobNumber ? jobsByNumber.get(jobNumber.trim().toLowerCase()) : undefined;
    const linked = !!matchedJobId && !linkedJobIds.has(matchedJobId);
    if (matchedJobId && linked) linkedJobIds.add(matchedJobId);
    return {
      row: {
        org_id: orgId,
        hoa_id: hoa.id,
        job_id: linked ? matchedJobId! : null,
        job_number: jobNumber,
        job_name: pick(row, "jobName") || "",
        address,
        status: (HOA_JOB_STATUSES as readonly string[]).includes(status) ? status : "Need to Submit",
        assigned_to: pick(row, "assignedTo") || "",
        assigned_date: pick(row, "assignedDate") || null,
        date_submitted: pick(row, "dateSubmitted") || null,
        date_approved: pick(row, "dateApproved") || null,
        notes: pick(row, "notes") || "",
      },
      skipped: false,
      linked,
    };
  });
}

// Data fields eligible to be filled in on an existing HOA job when a
// re-uploaded spreadsheet has a value the current record is missing.
// Deliberately excludes status and assigned_to — a fill-gaps upload should
// never silently move a job's workflow state or reassign the HOA tech it's
// already assigned to; those only change through the app itself.
function buildHoaJobFillPatch(
  row: CsvRecord,
  existing: HoaJob,
  matchedJobId: string | undefined,
  linked: boolean,
): TablesUpdate<"hoa_jobs"> | null {
  const patch: TablesUpdate<"hoa_jobs"> = {};
  const isEmpty = (v: unknown) => v === null || v === undefined || v === "";
  const maybeSet = <K extends keyof TablesUpdate<"hoa_jobs">>(field: K, existingVal: unknown, incoming: TablesUpdate<"hoa_jobs">[K]) => {
    if (isEmpty(existingVal) && !isEmpty(incoming as unknown)) patch[field] = incoming;
  };
  maybeSet("job_name", existing.job_name, pick(row, "jobName"));
  maybeSet("address", existing.address, pick(row, "address").trim());
  maybeSet("notes", existing.notes, pick(row, "notes") || null);
  maybeSet("assigned_date", existing.assigned_date, pick(row, "assignedDate") || null);
  maybeSet("date_submitted", existing.date_submitted, pick(row, "dateSubmitted") || null);
  maybeSet("date_approved", existing.date_approved, pick(row, "dateApproved") || null);
  if (isEmpty(existing.job_id) && matchedJobId && linked) patch.job_id = matchedJobId;
  return Object.keys(patch).length > 0 ? patch : null;
}

export interface HoaJobImportPlanRow {
  action: "insert" | "update" | "skip";
  jobNumber: string;
  insertRow?: TablesInsert<"hoa_jobs">;
  updatePatch?: TablesUpdate<"hoa_jobs">;
  existingId?: string;
  reason?: string;
}

// Plans an HOA job import against the org's current hoa_jobs: a brand-new
// job number is inserted (and auto-linked to a matching Permit Inventory
// job by job_id, same as before); a job number that already exists in HOA
// Tracker gets only its missing fields filled in rather than creating a
// duplicate row.
export function planHoaJobImportRows(
  records: CsvRecord[],
  orgId: string,
  hoas: { id: string; name: string }[],
  jobs: { id: string; job_number: string }[] = [],
  existingHoaJobs: HoaJob[] = [],
  alreadyLinkedJobIds: Iterable<string> = [],
): HoaJobImportPlanRow[] {
  const jobsByNumber = new Map(jobs.map((j) => [j.job_number.trim().toLowerCase(), j.id]));
  const existingByNumber = new Map(
    existingHoaJobs
      .filter((j): j is HoaJob & { job_number: string } => !!j.job_number)
      .map((j) => [j.job_number.trim().toLowerCase(), j]),
  );
  const linkedJobIds = new Set(alreadyLinkedJobIds);
  const seenInFile = new Set<string>();
  return records.map((row) => {
    const hoaName = pick(row, "hoaName").trim();
    const address = pick(row, "address").trim();
    const hoa = hoas.find((h) => h.name.toLowerCase() === hoaName.toLowerCase());
    const jobNumber = pick(row, "jobNumber") || "";
    const key = jobNumber.trim().toLowerCase();
    const matchedJobId = jobNumber ? jobsByNumber.get(key) : undefined;
    const existing = key ? existingByNumber.get(key) : undefined;

    if (existing) {
      if (seenInFile.has(key)) return { action: "skip", jobNumber, reason: "duplicate in file" };
      seenInFile.add(key);
      const linked = !!matchedJobId && !linkedJobIds.has(matchedJobId);
      if (matchedJobId && linked) linkedJobIds.add(matchedJobId);
      const patch = buildHoaJobFillPatch(row, existing, matchedJobId, linked);
      return patch
        ? { action: "update", jobNumber, updatePatch: patch, existingId: existing.id }
        : { action: "skip", jobNumber, reason: "already up to date" };
    }

    if (!hoa || !address) {
      return { action: "skip", jobNumber, reason: !hoa ? "HOA not found" : "missing address" };
    }
    if (key && seenInFile.has(key)) return { action: "skip", jobNumber, reason: "duplicate in file" };
    if (key) seenInFile.add(key);
    const status = pick(row, "status");
    const linked = !!matchedJobId && !linkedJobIds.has(matchedJobId);
    if (matchedJobId && linked) linkedJobIds.add(matchedJobId);
    return {
      action: "insert",
      jobNumber,
      insertRow: {
        org_id: orgId,
        hoa_id: hoa.id,
        job_id: linked ? matchedJobId! : null,
        job_number: jobNumber,
        job_name: pick(row, "jobName") || "",
        address,
        status: (HOA_JOB_STATUSES as readonly string[]).includes(status) ? status : "Need to Submit",
        assigned_to: pick(row, "assignedTo") || "",
        assigned_date: pick(row, "assignedDate") || null,
        date_submitted: pick(row, "dateSubmitted") || null,
        date_approved: pick(row, "dateApproved") || null,
        notes: pick(row, "notes") || "",
      },
    };
  });
}
