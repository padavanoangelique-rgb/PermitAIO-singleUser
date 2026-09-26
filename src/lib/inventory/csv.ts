import type { Tables } from "@/lib/supabase/types";

type Job = Tables<"jobs">;
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
  const headers = rows[0].map((h) => h.trim().toLowerCase());
  return rows.slice(1).map((cells) => {
    const obj: CsvRecord = {};
    headers.forEach((h, i) => {
      obj[h] = (cells[i] ?? "").trim();
    });
    return obj;
  });
}

export function normalizeDateForImport(value: string): string | null {
  const t = value.trim();
  if (!t) return null;
  const slash = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slash) {
    const [, m, d, y] = slash;
    const year = y.length === 2 ? `20${y}` : y;
    const mm = Number(m);
    const dd = Number(d);
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
    return `${year}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
  }
  const iso = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const [, y, m, d] = iso;
    const mm = Number(m);
    const dd = Number(d);
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
    return `${y}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
  }
  return null;
}

const backupColumns = [
  "client_name", "job_number", "sale_date", "trade_type", "contract_value",
  "permit_number", "jurisdiction", "sub_status", "stage", "permit_tech",
  "noc_status", "assigned_date", "submitted_date", "approved_date", "ordered_date", "material_eta", "noc_date", "notes",
] as const;

const esc = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;

export function buildBackupCsv(jobs: Job[]): string {
  return [
    backupColumns.join(","),
    ...jobs.map((job) => backupColumns.map((column) => esc(job[column])).join(",")),
  ].join("\n");
}

export function buildInReviewCsv(jobs: Job[]): string {
  const today = new Date().toISOString().slice(0, 10);
  const rows = jobs
    .filter((j) => j.submitted_date && !j.approved_date)
    .map((j) => ({
      job: j,
      days: Math.round((new Date(today).getTime() - new Date(j.submitted_date!).getTime()) / (1000 * 60 * 60 * 24)),
    }))
    .sort((a, b) => b.days - a.days);
  const headers = [
    "Days in Review", "Client", "Job #", "Permit #", "Jurisdiction", "Product",
    "Value", "Permit Tech", "Job Status", "Assigned", "Submitted", "NOC", "Over 30 Days", "Notes",
  ];
  const lines = [
    headers.join(","),
    ...rows.map(({ job: j, days }) => [
      days, j.client_name, j.job_number, j.permit_number ?? "", j.jurisdiction ?? "",
      j.trade_type ?? "", j.contract_value ?? "", j.permit_tech, j.stage,
      j.assigned_date ?? "", j.submitted_date ?? "", j.noc_status, days >= 30 ? "YES" : "", j.notes ?? "",
    ].map(esc).join(",")),
  ];
  const totalValue = rows.reduce((s, r) => s + (r.job.contract_value ?? 0), 0);
  lines.push("");
  lines.push([esc("TOTAL"), esc(`${rows.length} permits in review`), "", "", "", "", esc(totalValue)].join(","));
  lines.push([
    esc("OVER 30 DAYS"), esc(`${rows.filter((r) => r.days >= 30).length} permits`), "", "", "", "",
    esc(rows.filter((r) => r.days >= 30).reduce((s, r) => s + (r.job.contract_value ?? 0), 0)),
  ].join(","));
  return "﻿" + lines.join("\n");
}
