/**
 * Public county GIS parcel lookup.
 * Miami-Dade and Palm Beach use county layers.
 * Broward uses the county parcel-boundary layer (faster than statewide FDOR).
 * City still comes from millage, not the folio prefix.
 */

export type ParcelCountyKey = "miami-dade" | "broward" | "palm-beach";

export type ParcelHit = {
  folio: string;
  owner: string;
  address: string;
  city: string;
  zip: string;
  millageCode: string | null;
  /** Full legal description, joined from the county's legal-description
   * field(s). Null when the record has none set, or when the county's
   * public parcel layer doesn't expose one at all (Miami-Dade). */
  legalDescription: string | null;
  countyKey: ParcelCountyKey;
  countyLabel: string;
};

const BROWARD_MILLAGE_TO_CITY: Record<string, string> = {
  "0012": "Unincorporated Broward County",
  "0013": "Unincorporated Broward County",
  "0211": "Lauderdale-By-The-Sea",
  "0311": "Fort Lauderdale",
  "0312": "Fort Lauderdale",
  "0412": "Dania Beach",
  "0413": "Dania Beach",
  "0512": "Hollywood",
  "0513": "Hollywood",
  "0613": "Pembroke Park",
  "0912": "Wilton Manors",
  "1013": "Cooper City",
  "1111": "Deerfield Beach",
  "1112": "Deerfield Beach",
  "1212": "Margate",
  "1311": "Hillsboro Beach",
  "1411": "Lighthouse Point",
  "1511": "Pompano Beach",
  "1512": "Pompano Beach",
  "1611": "Sea Ranch Lakes",
  "1712": "Oakland Park",
  "1812": "Lazy Lake",
  "1912": "Lauderhill",
  "2012": "Lauderdale Lakes",
  "2112": "Sunrise",
  "2212": "Plantation",
  "2412": "Davie",
  "2413": "Davie",
  "2513": "Hallandale Beach",
  "2613": "Pembroke Pines",
  "2713": "Miramar",
  "2812": "Coral Springs",
  "2912": "North Lauderdale",
  "3012": "Parkland",
  "3112": "Tamarac",
  "3212": "Coconut Creek",
  "3312": "Weston",
  "3313": "Weston",
  "3413": "Southwest Ranches",
  "3513": "West Park",
  "9312": "Fort Lauderdale",
};

export function cityFromBrowardMillage(code: string | null | undefined): string | null {
  const digits = (code ?? "").replace(/[^0-9]/g, "").slice(0, 4);
  if (digits.length !== 4) return null;
  return BROWARD_MILLAGE_TO_CITY[digits] ?? null;
}

export function inventoryCountyLabel(key: ParcelCountyKey): string {
  if (key === "miami-dade") return "Miami-Dade County";
  if (key === "palm-beach") return "Palm Beach County";
  return "Broward County";
}

type Adapter = {
  url: string;
  fields: {
    folio: string;
    owner: string;
    address: string;
    city: string;
    zip: string;
    millage?: string;
    /** Legal-description field(s), joined in order when present. Palm
     * Beach splits it across up to three fields; Broward uses one. */
    legal?: string[];
  };
  where: (q: string) => string;
};

function esc(q: string): string {
  return q.replace(/'/g, "''").toUpperCase();
}

const ADAPTERS: Record<ParcelCountyKey, Adapter> = {
  "miami-dade": {
    url: "https://gisweb.miamidade.gov/arcgis/rest/services/MD_LandInformation/MapServer/26",
    fields: {
      folio: "FOLIO",
      owner: "TRUE_OWNER1",
      address: "TRUE_SITE_ADDR",
      city: "TRUE_SITE_CITY",
      zip: "TRUE_SITE_ZIP_CODE",
      // Miami-Dade's public parcel layer doesn't expose a legal-description
      // field — there's no `legal` here on purpose. Callers should treat
      // a Miami-Dade hit's legalDescription as always null, not missing data.
    },
    where: (q) => {
      const u = esc(q);
      return `UPPER(FOLIO) LIKE '%${u}%' OR UPPER(TRUE_OWNER1) LIKE '%${u}%' OR UPPER(TRUE_SITE_ADDR) LIKE '%${u}%'`;
    },
  },
  "palm-beach": {
    url: "https://services1.arcgis.com/ZWOoUZbtaYePLlPw/arcgis/rest/services/Parcels_and_Property_Details_WebMercator/FeatureServer/0",
    fields: {
      folio: "PARID",
      owner: "OWNER_NAME1",
      address: "SITE_ADDR_STR",
      city: "MUNICIPALITY",
      zip: "ZIP1",
      legal: ["LEGAL1", "LEGAL2", "LEGAL3"],
    },
    where: (q) => {
      const u = esc(q);
      return `UPPER(PARID) LIKE '%${u}%' OR UPPER(OWNER_NAME1) LIKE '%${u}%' OR UPPER(SITE_ADDR_STR) LIKE '%${u}%'`;
    },
  },
  broward: {
    url: "https://services5.arcgis.com/wI5GZmCtnUU8ueya/arcgis/rest/services/Broward_County_Parcel_Boundary/FeatureServer/1",
    fields: {
      folio: "PARCELNO",
      owner: "OWN_NAME",
      address: "PHY_ADDR1",
      city: "PHY_CITY",
      zip: "PHY_ZIPCD",
      millage: "TAX_AUTH_CD",
      legal: ["S_LEGAL"],
    },
    where: (q) => {
      const u = esc(q);
      return `UPPER(PARCELNO) LIKE '%${u}%' OR UPPER(OWN_NAME) LIKE '%${u}%' OR UPPER(PHY_ADDR1) LIKE '%${u}%'`;
    },
  },
};

export async function lookupParcel(county: ParcelCountyKey, query: string): Promise<ParcelHit[]> {
  const trimmed = query.trim();
  if (trimmed.length < 4) return [];
  const c = ADAPTERS[county];
  const outFields = [c.fields.folio, c.fields.owner, c.fields.address, c.fields.city, c.fields.zip];
  if (c.fields.millage) outFields.push(c.fields.millage);
  if (c.fields.legal) outFields.push(...c.fields.legal);
  const params = new URLSearchParams({
    where: c.where(trimmed),
    outFields: outFields.join(","),
    returnGeometry: "false",
    resultRecordCount: "10",
    f: "json",
  });
  const res = await fetch(`${c.url}/query?${params}`);
  if (!res.ok) throw new Error(`Parcel lookup failed (${res.status})`);
  const data = (await res.json()) as {
    features?: { attributes: Record<string, string | number | null> }[];
    error?: { message?: string };
  };
  if (data.error?.message) throw new Error(data.error.message);
  return (data.features ?? []).map((f) => {
    const a = f.attributes;
    const millageRaw = c.fields.millage ? String(a[c.fields.millage] ?? "") : "";
    const millage = millageRaw.replace(/[^0-9]/g, "").slice(0, 4) || null;
    const mappedCity = county === "broward" ? cityFromBrowardMillage(millage) : null;
    const legalDescription = c.fields.legal
      ? c.fields.legal
          .map((field) => String(a[field] ?? "").trim())
          .filter(Boolean)
          .join(" ")
          .trim() || null
      : null;
    return {
      folio: String(a[c.fields.folio] ?? ""),
      owner: String(a[c.fields.owner] ?? ""),
      address: String(a[c.fields.address] ?? ""),
      city: mappedCity || String(a[c.fields.city] ?? ""),
      zip: String(a[c.fields.zip] ?? ""),
      millageCode: county === "broward" ? millage : null,
      legalDescription,
      countyKey: county,
      countyLabel: inventoryCountyLabel(county),
    };
  });
}
