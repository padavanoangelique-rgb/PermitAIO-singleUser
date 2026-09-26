import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/** `jobs` columns this agent is allowed to write. Mirrors the field list
 * already exposed by the CSV import tool (src/lib/inventory/csv.ts) so the
 * two onboarding paths use the same vocabulary. */
export const TARGET_FIELDS = [
  "client_name",
  "job_number",
  "address",
  "folio_number",
  "trade_type",
  "contract_value",
  "permit_number",
  "jurisdiction",
  "stage",
  "sub_status",
  "sale_date",
  "assigned_date",
  "submitted_date",
  "approved_date",
  "ordered_date",
  "material_eta",
  "noc_date",
  "permit_tech",
  "noc_status",
  "city",
  "notes",
] as const;
export type TargetField = (typeof TARGET_FIELDS)[number];

/** Fixed 8-value enum — matches the `jobs_sub_status_check` constraint from
 * 27_permit_status_values.sql. Checked in TS as a safety net so a bad sheet
 * value never even reaches the DB constraint. */
export const SUB_STATUS_VALUES = [
  "Need to Submit",
  "Quote Needed",
  "Engineering Pending",
  "In Review",
  "Corrections Needed",
  "Approved",
  "Approved and Printed",
  "Complete",
] as const;

const DATE_FIELDS = new Set(["sale_date", "assigned_date", "submitted_date", "approved_date", "ordered_date", "material_eta", "noc_date"]);

function compact(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function isValidSubStatus(value: string): string | null {
  const target = compact(value);
  for (const status of SUB_STATUS_VALUES) {
    if (compact(status) === target) return status;
  }
  return null;
}

/** Stage has no fixed global list — valid values are whatever rows exist in
 * that org's own `stages` table (seeded per-org, editable per-org). */
export async function isValidStage(orgId: string, value: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await (admin as unknown as { from: (t: string) => any })
    .from("stages")
    .select("name")
    .eq("org_id", orgId);
  const target = compact(value);
  const match = (data ?? []).find((row: { name: string }) => compact(row.name) === target);
  return match?.name ?? null;
}

export function parseSheetDate(raw: string): string | null {
  const value = raw.trim().replace(/[.,]/g, " ").replace(/\s+/g, " ");
  if (!value) return null;
  const iso = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  const us = value.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
  if (us) {
    const year = us[3].length === 2 ? `20${us[3]}` : us[3];
    return `${year}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`;
  }
  return null;
}

/**
 * Validates + normalizes one cell value for a target field before writing.
 * Returns null (skip this field on this row) if the value doesn't pass.
 */
export async function normalizeFieldValue(
  orgId: string,
  field: TargetField,
  rawValue: string,
): Promise<string | number | null> {
  const value = rawValue.trim();
  if (!value) return null;

  if (field === "sub_status") return isValidSubStatus(value);
  if (field === "stage") return isValidStage(orgId, value);
  if (DATE_FIELDS.has(field)) return parseSheetDate(value);
  if (field === "contract_value") {
    const num = Number(value.replace(/[$,]/g, ""));
    return Number.isFinite(num) ? num : null;
  }
  return value;
}

/**
 * Best-guess header → target-field suggestions, shown pre-filled in the
 * mapping wizard so the admin confirms/adjusts rather than starting from a
 * blank dropdown for every column.
 */
const HEADER_ALIASES: Record<TargetField, string[]> = {
  job_number: ["job number", "job #", "job#", "job no", "jobnumber", "job"],
  client_name: ["client name", "client", "customer", "customer name", "homeowner", "name"],
  address: ["address", "job address", "property address", "site address"],
  folio_number: ["folio", "folio number", "folio #", "parcel", "parcel number"],
  trade_type: ["trade", "trade type", "type"],
  contract_value: ["contract value", "contract amount", "value", "price"],
  permit_number: ["permit number", "permit #", "permit#", "permitnumber"],
  jurisdiction: ["jurisdiction", "city permit office", "municipality", "county"],
  stage: ["stage", "job stage"],
  sub_status: ["sub status", "sub_status", "status", "permit status"],
  sale_date: ["sale date", "date sold"],
  assigned_date: ["assigned date", "date assigned", "assigned"],
  submitted_date: ["submitted date", "date submitted", "submitted"],
  approved_date: ["approved date", "date approved", "approved"],
  ordered_date: ["ordered date", "job ordered", "order date", "date ordered"],
  material_eta: ["material eta", "eta", "product eta", "materials eta"],
  noc_date: ["noc date", "notice of commencement date"],
  permit_tech: ["permit tech", "tech", "assigned to", "assigned tech"],
  noc_status: ["noc status", "notice of commencement status", "noc"],
  city: ["city"],
  notes: ["notes", "comments", "remarks"],
};

export function suggestFieldForHeader(header: string): TargetField | null {
  const target = compact(header);
  for (const field of TARGET_FIELDS) {
    if (compact(field) === target) return field;
  }
  for (const [field, aliases] of Object.entries(HEADER_ALIASES) as [TargetField, string[]][]) {
    if (aliases.some((alias) => compact(alias) === target)) return field;
  }
  return null;
}
