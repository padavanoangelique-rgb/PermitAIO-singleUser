import type { JobDataKey } from "@/lib/forms/pdf-fill";

function norm(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function isContractorish(n: string): boolean {
  return /\b(contractor|qualif|licensee|company name|business name|cgc|cbc|company-name)\b/.test(n);
}

function isArchitectish(n: string): boolean {
  return /\b(architect|engineer|pe name)\b/.test(n);
}

/**
 * Best-effort map from a PDF AcroForm field name to a JobData key.
 * Header rule: homeowner name, full job address, and contractor company
 * should resolve on every form that has a box for them.
 */
export function guessJobDataKey(pdfFieldName: string): JobDataKey | "" {
  const n = norm(pdfFieldName);
  if (!n) return "";

  const isContractor = isContractorish(n);
  const isArchitect = isArchitectish(n);

  if (/\b(folio|parcel|strap|tax id|folio number|pcn)\b/.test(n)) return "folio_number";
  if (/\b(permit number|permit no|permit #)\b/.test(n)) return "permit_number";
  if (/\b(job number|job no|job #|permit job)\b/.test(n)) return "job_number";
  if (/\b(legal description|legal desc)\b/.test(n)) return "legal_description";
  if (/\b(flood zone)\b/.test(n)) return "flood_zone";
  if (/\bbfe\b/.test(n) || /\bbase flood\b/.test(n)) return "bfe";
  if (/\b(floor area|sq ft|square feet|living area)\b/.test(n)) return "floor_area";
  if (/\b(job value|contract value|valuation|estimated value|cost of work|permit value)\b/.test(n))
    return "job_value";
  if (/\b(description of work|work description|scope of work|further work)\b/.test(n))
    return "description_of_work";
  if (/\b(today|application date|date of application|date signed)\b/.test(n))
    return "today_date";

  if (isArchitect) {
    if (/\bphone\b/.test(n)) return "architect_phone";
    if (/\bemail\b/.test(n)) return "architect_email";
    if (/\bzip\b/.test(n)) return "architect_zip";
    if (/\bcity\b/.test(n)) return "architect_city";
    if (/\bstate\b/.test(n)) return "architect_state";
    if (/\baddress\b/.test(n)) return "architect_address";
    if (/\bname\b/.test(n)) return "architect_name";
  }

  if (isContractor) {
    if (/\b(license|lic no|lic #|cgc|cbc)\b/.test(n)) return "contractor_license";
    if (/\b(qualifier|qualifying)\b/.test(n)) return "qualifier_name";
    if (/\b(btr|business tax|local business tax)\b/.test(n))
      return "business_tax_receipt_number";
    if (/\bphone\b/.test(n) || /\btel\b/.test(n)) return "contractor_phone";
    if (/\bemail\b/.test(n)) return "contractor_email";
    if (/\bzip\b/.test(n)) return "contractor_zip";
    if (/\bcity\b/.test(n)) return "contractor_city";
    if (/\bstate\b/.test(n)) return "contractor_state";
    if (/\baddress\b/.test(n) || /\bstreet\b/.test(n)) return "contractor_address";
    if (/\b(company|business|contractor name|firm|printed name)\b/.test(n))
      return "contractor_company";
    if (/\bname\b/.test(n)) return "contractor_company";
  }

  if (/\bphone\b/.test(n) || /\btel\b/.test(n)) {
    return !isContractor ? "owner_phone" : "contractor_phone";
  }
  if (/\bemail\b/.test(n)) {
    return !isContractor ? "owner_email" : "contractor_email";
  }

  if (/\b(unit|suite|apt)\b/.test(n) && !isContractor) return "job_unit";
  if (/\b(jurisdiction|municipality)\b/.test(n)) return "jurisdiction";

  if (/\bcity\b/.test(n) && !isContractor) return "job_city";

  if (
    !isContractor &&
    (/\b(job site|site address|project address|property address|street address|location)\b/.test(n) ||
      ((/\baddress\b/.test(n) || /\bstreet\b/.test(n)) && !/\b(city|state|zip|unit)\b/.test(n)))
  ) {
    return "job_address_full";
  }

  if (
    /\b(homeowner|home owner|owner name|name of owner|property owner|applicant name|printed name of owner)\b/.test(n) ||
    ((/\bname\b/.test(n) || /\bowner\b/.test(n) || /\bapplicant\b/.test(n) || /\bclient\b/.test(n)) &&
      !isContractor &&
      !isArchitect)
  ) {
    return "client_name";
  }

  return "";
}

export function guessFieldMapping(fieldNames: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  for (const name of fieldNames) {
    const key = guessJobDataKey(name);
    if (key) mapping[name] = key;
  }
  return mapping;
}

function firstMatch(fieldNames: string[], test: (n: string) => boolean): string | undefined {
  return fieldNames.find((name) => test(norm(name)));
}

/** Fill still-unmapped header boxes. Never overwrite an admin mapping. */
export function ensureHeaderMapping(
  fieldNames: string[],
  mapping: Record<string, string>,
): Record<string, string> {
  const next: Record<string, string> = { ...mapping };
  for (const name of fieldNames) {
    if (next[name]) continue;
    const key = guessJobDataKey(name);
    if (key) next[name] = key;
  }

  const values = new Set(Object.values(next));

  if (!values.has("client_name")) {
    const f = firstMatch(
      fieldNames,
      (n) =>
        !isContractorish(n) &&
        !isArchitectish(n) &&
        /\b(homeowner|home owner|owner name|property owner|applicant|owner|client|name)\b/.test(n) &&
        !/\b(phone|email|address|city|zip|license)\b/.test(n),
    );
    if (f && !next[f]) next[f] = "client_name";
  }

  if (!values.has("job_address") && !values.has("job_address_full")) {
    const f = firstMatch(
      fieldNames,
      (n) =>
        !isContractorish(n) &&
        /\b(address|street|job site|project|property|location)\b/.test(n) &&
        !/\b(phone|email|city|state|zip|architect|engineer|bond|mortgage)\b/.test(n),
    );
    if (f && !next[f]) next[f] = "job_address_full";
  }

  if (!values.has("contractor_company")) {
    const f = firstMatch(
      fieldNames,
      (n) =>
        isContractorish(n) &&
        !/\b(phone|email|address|city|state|zip|license|lic|qualifier)\b/.test(n),
    );
    if (f && !next[f]) next[f] = "contractor_company";
  }

  return next;
}
