import type { FormCounty } from "./folio";
import { normalizeTradeFamily, roofCoveringFromTrade } from "@/lib/jobs/trade";

/**
 * Normalize a jurisdiction name for comparison: lowercase + collapse
 * whitespace + strip diacritics + drop parenthetical qualifiers so
 * "Miami-Dade County (unincorporated + cities without their own form)"
 * still matches a user's "Miami-Dade" search.
 */
function canonicalJurisdiction(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .replace(/\(.*?\)/g, "") // drop parenthetical suffix
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+county\b/g, "") // "miami-dade county" -> "miami-dade"
    .replace(/\s+/g, " ")
    .trim();
}

export interface FormTemplateRow {
  id: string;
  county: string;
  jurisdiction_code: string | null;
  jurisdiction_name: string | null;
  doc_type: string;
  title: string;
  description: string | null;
  file_name: string | null;
  file_data: string | null;
  field_mapping: Record<string, string>;
  sort_order: number;
  /** 'general' applies to every trade; otherwise scopes to a specific trade (e.g. 'windows', 'roofing'). */
  trade: string;
}

export interface MatchedForms {
  /** County-wide forms — apply to every job in the county (jurisdiction_code is null). */
  base: FormTemplateRow[];
  /** Addendum forms that only apply to the detected municipality code. */
  specific: FormTemplateRow[];
}

/**
 * Additive matching: base (county-wide) forms are always included; forms
 * scoped to a specific municipality code are appended on top when that
 * code is detected. This is NOT either/or — a job in a municipality with
 * its own addendum gets BOTH the county base forms and the addendum.
 *
 * Trade filtering is a second, independent AND condition: a form with
 * trade = 'general' matches any job. A form with trade = 'windows' or
 * 'roofing' matches any job in that normalized trade family (so 'roofing'
 * matches Tile/Shingle/Metal/roofing/historical 'Roof' jobs alike). A form
 * scoped to a specific roof covering ('tile'/'shingle'/'metal') only
 * matches jobs with that exact covering. A job's trade never widens which
 * county/municipality forms apply — it only narrows within whatever the
 * folio/code already matched.
 */
export function matchFormTemplates(
  all: FormTemplateRow[],
  county: FormCounty,
  code: string | null,
  trade?: string | null,
  jurisdictionName?: string | null,
): MatchedForms {
  const tradeMatches = (r: FormTemplateRow) => {
    const rawRowTrade = (r.trade ?? "").trim().toLowerCase();
    // Historical DB values include both "windows" and "windows_doors" for the
    // same trade family (Coral Springs / Miramar / Pembroke Pines uploads
    // used "windows_doors"). Treat them as the same family so window jobs
    // pick up every window/door template regardless of which label the
    // uploader used. Same shape for doors_windows just in case.
    const rowTrade =
      rawRowTrade === "windows_doors" || rawRowTrade === "doors_windows"
        ? "windows"
        : rawRowTrade;
    if (rowTrade === "general" || !rowTrade) return true;
    const jobFamily = normalizeTradeFamily(trade);
    if (jobFamily === "general") return true;
    if (rowTrade === "windows" || rowTrade === "roofing") return rowTrade === jobFamily;
    const jobCovering = roofCoveringFromTrade(trade);
    if (jobCovering) return rowTrade === jobCovering;
    return rowTrade === (trade ?? "").trim().toLowerCase();
  };
  const countyRows = all.filter((r) => r.county === county && tradeMatches(r));

  // A row is "county-wide" (base) only when it has neither a jurisdiction_name
  // nor a jurisdiction_code. Historically some city rows were uploaded with
  // jurisdiction_name set but jurisdiction_code = null (Miramar, Pembroke
  // Pines, Plantation, Coral Springs, Boynton Beach) — those must still be
  // treated as city-specific so they only fire on jobs in that city. This
  // matches Angelique's rule: "Miramar's form should connect when Miramar is
  // typed in the jurisdiction".
  const jobJurisdiction = canonicalJurisdiction(jurisdictionName);
  const base = countyRows
    .filter((r) => !r.jurisdiction_code && !r.jurisdiction_name)
    .sort((a, b) => a.sort_order - b.sort_order);

  // City-specific rows match either by explicit code (legacy Davie=2413 style)
  // OR by canonicalized jurisdiction_name (the modern, source-of-truth path).
  // Parenthetical suffixes like "(unincorporated + cities without their own
  // form)" are stripped by canonicalJurisdiction so the county-level Miami-
  // Dade permit app still matches "Miami-Dade" as the picked jurisdiction.
  const specific = countyRows
    .filter((r) => {
      if (!r.jurisdiction_code && !r.jurisdiction_name) return false;
      const codeMatch = code && r.jurisdiction_code === code;
      const nameMatch =
        jobJurisdiction &&
        r.jurisdiction_name &&
        canonicalJurisdiction(r.jurisdiction_name) === jobJurisdiction;
      return Boolean(codeMatch || nameMatch);
    })
    .sort((a, b) => a.sort_order - b.sort_order);

  return { base, specific };
}

export const DOC_TYPE_LABELS: Record<string, string> = {
  permit_application: "Permit Application",
  notice_of_commencement: "Notice of Commencement",
  addendum: "Addendum",
  affidavit: "Affidavit",
  checklist: "Checklist",
  other: "Other",
};
