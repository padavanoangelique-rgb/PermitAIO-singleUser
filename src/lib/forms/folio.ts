/**
 * Folio / Parcel Control Number parsing for the Forms Generator.
 *
 * Sources:
 *   Miami-Dade: first 2 digits of the 13-digit folio = municipality.
 *   Palm Beach: first 2 digits of the 17-digit PCN = municipality.
 *   Broward: folio does NOT encode the city. Use the 4-digit BCPA millage /
 *   tax district code only (Fort Lauderdale 0312, Davie 2413, Miramar 2713).
 */

import { countyOf } from "@/lib/inventory/constants";
import { cityFromBrowardMillage } from "@/lib/parcel/lookup";

export type FormCounty = "Broward" | "Miami-Dade" | "Palm Beach" | "Martin" | "St. Lucie";

export const FORM_COUNTIES: FormCounty[] = [
  "Broward",
  "Miami-Dade",
  "Palm Beach",
  "Martin",
  "St. Lucie",
];

export function normalizeFolioDigits(raw: string | null | undefined): string {
  return (raw ?? "").replace(/[^0-9]/g, "");
}

export type FolioDetection =
  | { ok: true; county: FormCounty; code: string }
  | { ok: false; county: FormCounty; status: "empty" | "incomplete" | "invalid"; reason: string };

/**
 * Detects the municipality code used to look up a job's jurisdiction:
 *  - Miami-Dade: first 2 digits of the 13-digit folio number.
 *  - Palm Beach: first 2 digits of the 17-digit parcel control number.
 *  - Broward: the 4-digit Tax District / Millage Code. Passing a Broward
 *    folio here is invalid on purpose — first two folio digits are township.
 */
export function detectMunicipalityCode(
  county: FormCounty,
  value: string | null | undefined,
): FolioDetection {
  const digits = normalizeFolioDigits(value);

  if (county === "Broward") {
    if (digits.length === 0) {
      return { ok: false, county, status: "empty", reason: "Enter the 4-digit Tax/Millage Code." };
    }
    // A real Broward folio is far longer than 4 digits. Never treat it as millage.
    if (digits.length > 4) {
      return {
        ok: false,
        county,
        status: "invalid",
        reason: "Broward city is the 4-digit millage code, not the folio number.",
      };
    }
    if (digits.length < 4) {
      return {
        ok: false,
        county,
        status: "incomplete",
        reason: `Broward tax district / millage codes are 4 digits (e.g. 0312 for Fort Lauderdale). ${4 - digits.length} more digit${4 - digits.length === 1 ? "" : "s"} needed.`,
      };
    }
    return { ok: true, county, code: digits };
  }

  const expected = county === "Miami-Dade" ? 13 : 17;
  const formatHint =
    county === "Miami-Dade"
      ? "Miami-Dade folio numbers are 13 digits (format 99-9999-999-9999)."
      : "Palm Beach parcel control numbers are 17 digits (format XX-XX-XX-XX-XXX-XXXX).";

  if (digits.length === 0) {
    return {
      ok: false,
      county,
      status: "empty",
      reason: county === "Miami-Dade" ? "Enter the 13-digit folio number." : "Enter the 17-digit parcel control number.",
    };
  }
  if (digits.length !== expected) {
    return {
      ok: false,
      county,
      status: digits.length < expected ? "incomplete" : "invalid",
      reason: `${formatHint} This number has ${digits.length} digit${digits.length === 1 ? "" : "s"}.`,
    };
  }
  return { ok: true, county, code: digits.slice(0, 2) };
}

export function guessCountyFromText(text: string | null | undefined): FormCounty | null {
  const t = (text ?? "").toLowerCase();
  if (t.includes("broward")) return "Broward";
  if (t.includes("miami-dade") || t.includes("miami dade")) return "Miami-Dade";
  if (t.includes("palm beach")) return "Palm Beach";
  const resolved = (countyOf(text ?? "") ?? "").replace(/\s+County$/i, "");
  if (resolved === "Broward" || resolved === "Miami-Dade" || resolved === "Palm Beach") {
    return resolved;
  }
  return null;
}

export function formatFolioMask(county: FormCounty): string {
  if (county === "Miami-Dade") return "99-9999-999-9999";
  if (county === "Palm Beach") return "99-99-99-99-99-999-9999";
  return "";
}

export const BROWARD_TAX_CODE_PLACEHOLDER = "0312";

export { cityFromBrowardMillage };
