/**
 * Requirements & Forms — city ↔ county "borrow" rules.
 *
 * When a user selects a city (or a job's jurisdiction is a city), some
 * countywide rows are borrowed into the city's checklist so the user
 * doesn't have to jump between city and county pages:
 *
 *  - Palm Beach city → borrows the PBC countywide permit application and NOC
 *  - Broward city    → borrows the Broward countywide permit application and NOC
 *  - Miami-Dade city → borrows ONLY the Miami-Dade County "Application for
 *                       Municipal Permit" companion form + NOC. Each MD city
 *                       has its own primary permit application, so the county
 *                       permit application row (if any) is not borrowed.
 *
 * The rule is defined by (county → set of doc_types that are borrowed from
 * the county row). "notice_of_commencement" is always borrowed. Permit
 * applications follow the per-county behavior above.
 *
 * This module is used by both the sidebar Requirements & Forms page and
 * the per-job panel to build the checklist for a chosen city.
 */
import type { FormCounty } from "@/lib/forms/folio";

export type RequirementsRow = {
  id: number;
  jurisdiction: string;
  title: string;
  notes: string | null;
  file_name: string | null;
  file_data: string | null;
  county: string | null;
  doc_type: string;
  trade: string;
};

const COUNTY_LABEL: Record<FormCounty, string> = {
  Broward: "Broward County",
  "Miami-Dade": "Miami-Dade County",
  "Palm Beach": "Palm Beach County",
  Martin: "Martin County",
  "St. Lucie": "St. Lucie County",
};

/**
 * Doc types borrowed from the countywide rows for a given city. Keyed by
 * FormCounty; the values are the set of `doc_type` strings that are
 * inherited from the "<County> County" row when a user has selected a
 * city (not the county-wide row itself).
 */
const BORROWED_DOC_TYPES: Record<FormCounty, ReadonlySet<string>> = {
  "Palm Beach": new Set(["permit_application", "notice_of_commencement"]),
  Broward: new Set(["permit_application", "notice_of_commencement"]),
  // Miami-Dade cities have their own permit applications; we only pull in
  // the county NOC + the county "Application for Municipal Permit" companion
  // form (which is a doc_type='addendum' row already carried under the
  // "Miami-Dade County" jurisdiction).
  "Miami-Dade": new Set(["notice_of_commencement", "addendum"]),
  // Treasure Coast counties don't yet have city-level rows on file; when they
  // do, cities borrow the same base pair (permit app + NOC) that Broward and
  // Palm Beach cities inherit from their county-wide row.
  Martin: new Set(["permit_application", "notice_of_commencement"]),
  "St. Lucie": new Set(["permit_application", "notice_of_commencement"]),
};

/** True when this row is a county-wide row (not a city row). */
export function isCountyLevelRow(row: RequirementsRow, county: FormCounty): boolean {
  return row.jurisdiction === COUNTY_LABEL[county];
}

/** True when this row is a city row (not a county row) in the given county. */
export function isCityRow(row: RequirementsRow, county: FormCounty, city: string): boolean {
  if (!row.county || row.county !== county) return false;
  return row.jurisdiction.toLowerCase() === city.toLowerCase();
}

/**
 * Build the ordered checklist for a specific city:
 *  1. Contact block (doc_type='other', title contains "contact & forms")
 *  2. Permit Application
 *  3. Notice of Commencement
 *  4. Affidavit
 *  5. Addendum
 *  6. Other
 *
 * Within each group, city rows come first, then borrowed county rows.
 * Borrowed rows are marked with `borrowedFrom` so the UI can label them.
 */
export type ChecklistRow = RequirementsRow & { borrowedFrom: string | null };

export function buildCityChecklist(
  allRows: readonly RequirementsRow[],
  county: FormCounty,
  city: string,
): ChecklistRow[] {
  const cityRows = allRows.filter((r) => isCityRow(r, county, city));
  const countyRows = allRows.filter((r) => isCountyLevelRow(r, county));

  const borrowedTypes = BORROWED_DOC_TYPES[county];
  const borrowed: ChecklistRow[] = countyRows
    .filter((r) => borrowedTypes.has(r.doc_type))
    // Never borrow the county's own contact block into a city view.
    .filter((r) => !isContactRow(r))
    .map((r) => ({ ...r, borrowedFrom: COUNTY_LABEL[county] }));

  const cityChecklist: ChecklistRow[] = cityRows.map((r) => ({
    ...r,
    borrowedFrom: null,
  }));

  return [...cityChecklist, ...borrowed];
}

/**
 * Build the county-level checklist (when the user has selected a county
 * but not a specific city, or when the user picks "county-wide"). Simply
 * returns every row scoped to the "<County> County" jurisdiction.
 */
export function buildCountyChecklist(
  allRows: readonly RequirementsRow[],
  county: FormCounty,
): ChecklistRow[] {
  return allRows
    .filter((r) => isCountyLevelRow(r, county))
    .map((r) => ({ ...r, borrowedFrom: null }));
}

/**
 * Is this the "Building Department — contact & forms" row for a
 * jurisdiction? These rows are surfaced separately at the top of the
 * checklist as a contact block, not mixed into the "Other" group.
 */
export function isContactRow(row: RequirementsRow): boolean {
  return (
    row.doc_type === "other" &&
    /contact\s*&\s*forms/i.test(row.title)
  );
}

/**
 * Ordered display groups for a city checklist. Contact rows are pulled
 * to the top; the rest are grouped by doc_type in a stable order.
 */
export type ChecklistGroup =
  | { kind: "contact"; row: ChecklistRow }
  | { kind: "docType"; docType: string; rows: ChecklistRow[] };

export function groupChecklist(rows: ChecklistRow[]): ChecklistGroup[] {
  const contact = rows.find(isContactRow);
  const nonContact = rows.filter((r) => !isContactRow(r));

  const byType = new Map<string, ChecklistRow[]>();
  for (const r of nonContact) {
    const key = r.doc_type || "other";
    if (!byType.has(key)) byType.set(key, []);
    byType.get(key)!.push(r);
  }

  const order = [
    "permit_application",
    "notice_of_commencement",
    "affidavit",
    "addendum",
    "other",
  ];

  const groups: ChecklistGroup[] = [];
  if (contact) groups.push({ kind: "contact", row: contact });
  for (const docType of order) {
    const list = byType.get(docType);
    if (list && list.length) {
      groups.push({ kind: "docType", docType, rows: list });
    }
  }
  return groups;
}
