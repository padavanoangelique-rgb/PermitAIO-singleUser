/**
 * Complete jurisdiction catalog for the three tri-county service areas.
 *
 * Used by the Requirements & Forms UI to render every city in the county
 * picker, even for cities that don't yet have any forms on file. This is a
 * denormalized static list that mirrors the `folio_jurisdiction_codes`
 * table (deduped by name) so the UI doesn't have to make an extra round
 * trip to render the list.
 *
 * Keep this list in sync with folio_jurisdiction_codes when new
 * incorporations happen. Cross-check against:
 *   Miami-Dade: https://www.miamidade.gov/global/government/muni.page
 *   Broward:    https://www.broward.org/Directory/Pages/Municipalities.aspx
 *   Palm Beach: https://discover.pbcgov.org/pages/municipalities.aspx
 */
import type { FormCounty } from "@/lib/forms/folio";

export const ALL_JURISDICTIONS: Record<FormCounty, string[]> = {
  Broward: [
    "Coconut Creek",
    "Cooper City",
    "Coral Springs",
    "Dania Beach",
    "Davie",
    "Deerfield Beach",
    "Fort Lauderdale",
    "Hallandale Beach",
    "Hillsboro Beach",
    "Hollywood",
    "Lauderdale Lakes",
    "Lauderdale-By-The-Sea",
    "Lauderhill",
    "Lazy Lake",
    "Lighthouse Point",
    "Margate",
    "Miramar",
    "North Lauderdale",
    "Oakland Park",
    "Parkland",
    "Pembroke Park",
    "Pembroke Pines",
    "Plantation",
    "Pompano Beach",
    "Sea Ranch Lakes",
    "Southwest Ranches",
    "Sunrise",
    "Tamarac",
    "Unincorporated Broward County",
    "West Park",
    "Weston",
    "Wilton Manors",
  ],
  "Miami-Dade": [
    "Aventura",
    "Bal Harbour",
    "Bay Harbor Islands",
    "Biscayne Park",
    "Coral Gables",
    "Cutler Bay",
    "Doral",
    "El Portal",
    "Florida City",
    "Golden Beach",
    "Hialeah",
    "Hialeah Gardens",
    "Homestead",
    "Indian Creek",
    "Key Biscayne",
    "Medley",
    "Miami",
    "Miami Beach",
    "Miami Gardens",
    "Miami Lakes",
    "Miami Shores",
    "Miami Springs",
    "North Bay Village",
    "North Miami",
    "North Miami Beach",
    "Opa-locka",
    "Palmetto Bay",
    "Pinecrest",
    "South Miami",
    "Sunny Isles Beach",
    "Surfside",
    "Sweetwater",
    "Unincorporated Miami-Dade County",
    "Virginia Gardens",
    "West Miami",
  ],
  "Palm Beach": [
    "Atlantis",
    "Belle Glade",
    "Boca Raton",
    "Boynton Beach",
    "Briny Breezes",
    "Cloud Lake",
    "Delray Beach",
    "Glen Ridge",
    "Greenacres",
    "Gulf Stream",
    "Haverhill",
    "Highland Beach",
    "Hypoluxo",
    "Juno Beach",
    "Jupiter",
    "Jupiter Inlet Colony",
    "Lake Clarke Shores",
    "Lake Park",
    "Lake Worth Beach",
    "Lantana",
    "Loxahatchee Groves",
    "Manalapan",
    "Mangonia Park",
    "North Palm Beach",
    "Ocean Ridge",
    "Pahokee",
    "Palm Beach",
    "Palm Beach Gardens",
    "Palm Beach Shores",
    "Palm Springs",
    "Riviera Beach",
    "Royal Palm Beach",
    "South Bay",
    "South Palm Beach",
    "Tequesta",
    "Unincorporated Palm Beach County",
    "Village of Golf",
    "Wellington",
    "West Palm Beach",
    "Westlake",
  ],
  Martin: [
    "Jupiter Island",
    "Ocean Breeze",
    "Sewall's Point",
    "Stuart",
    "Unincorporated Martin County",
  ],
  "St. Lucie": [
    "Fort Pierce",
    "Port St. Lucie",
    "St. Lucie Village",
    "Unincorporated St. Lucie County",
  ],
};

/** Resolve a free-text jurisdiction to a canonical (county, city) pair. */
export function resolveJurisdiction(
  raw: string | null | undefined,
): { county: FormCounty; city: string } | null {
  const q = (raw ?? "").trim().toLowerCase();
  if (!q) return null;
  for (const county of Object.keys(ALL_JURISDICTIONS) as FormCounty[]) {
    const exact = ALL_JURISDICTIONS[county].find((c) => c.toLowerCase() === q);
    if (exact) return { county, city: exact };
  }
  // Fall back to substring match (helps when the job stores
  // "Boca Raton, FL 33432" style values).
  for (const county of Object.keys(ALL_JURISDICTIONS) as FormCounty[]) {
    const partial = ALL_JURISDICTIONS[county].find(
      (c) => c.length > 3 && q.includes(c.toLowerCase()),
    );
    if (partial) return { county, city: partial };
  }
  return null;
}

/**
 * Look up the folio jurisdiction_code that maps to a canonical city name in
 * a given county. This is how the Permit Package generator resolves
 * "which city-scoped forms apply" straight from the job's jurisdiction on
 * the Permit Inventory — no folio number needed.
 *
 * `templates` is the platform form_templates list already loaded by the
 * caller; we scan for the first row whose (county, jurisdiction_name)
 * matches (case-insensitive). We return `null` when the city has no city-
 * scoped template, which is the norm — most cities only borrow the county-
 * wide base forms and `matchFormTemplates` handles that with `code === null`.
 */
export function codeForJurisdiction(
  county: FormCounty,
  city: string | null | undefined,
  templates: ReadonlyArray<{ county: string; jurisdiction_code: string | null; jurisdiction_name: string | null }>,
): string | null {
  const target = (city ?? "").trim().toLowerCase();
  if (!target) return null;
  for (const t of templates) {
    if (t.county !== county) continue;
    if (!t.jurisdiction_code || !t.jurisdiction_name) continue;
    if (t.jurisdiction_name.trim().toLowerCase() === target) return t.jurisdiction_code;
  }
  return null;
}
