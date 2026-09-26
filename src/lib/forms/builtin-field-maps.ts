import { guessJobDataKey, ensureHeaderMapping } from "@/lib/forms/guess-mapping";

export const BROWARD_COUNTY_PERMIT_APP: Record<string, string> = {
  "12": "folio_number",
  "13": "flood_zone",
  "14": "bfe",
  "15": "floor_area",
  "16": "job_value",
  "17": "building_use",
  "18": "construction_type",
  "19": "occupancy_group",
  "20": "present_use",
  "21": "proposed_use",
  "22": "description_of_work",
  "31": "legal_description",
  "33": "client_name",
  "34": "owner_phone",
  "35": "owner_email",
  "36": "job_address",
  "37": "job_city",
  "40": "contractor_company",
  "41": "contractor_phone",
  "42": "contractor_email",
  "43": "contractor_address",
  "44": "contractor_city",
  "45": "contractor_state",
  "46": "contractor_zip",
  "47": "qualifier_name",
  "49": "contractor_license",
  "51": "business_tax_receipt_number",
  "52": "architect_name",
  "53": "architect_phone",
  "54": "architect_email",
  "55": "architect_address",
  "56": "architect_city",
  "57": "architect_state",
  "58": "architect_zip",
  "59": "bonding_company",
  "60": "bonding_address",
  "61": "bonding_city",
  "62": "bonding_state",
  "63": "bonding_zip",
  "64": "fee_simple_titleholder_name",
  "65": "fee_simple_titleholder_name",
  "66": "fee_simple_city",
  "67": "fee_simple_state",
  "68": "fee_simple_zip",
  "69": "mortgage_lender_name",
  "70": "mortgage_lender_address",
  "71": "mortgage_city",
  "72": "mortgage_state",
  "73": "mortgage_zip",
  "9-74": "job_address",
  "10-75": "job_unit",
  "11-76": "job_city",
  "8_af_date": "today_date",
};

export const PALM_BEACH_UNIVERSAL_PERMIT_APP: Record<string, string> = {
  Property_Owner: "client_name",
  Property_owner_address: "job_address_full",
  Property_owner_unit: "job_unit",
  Property_owner_city: "job_city",
  "Property-owner-phone": "owner_phone",
  "property-owner-email": "owner_email",
  "Project-address": "job_address_full",
  "project-city": "job_city",
  "Legal-description": "legal_description",
  further_work_description: "description_of_work",
  "permit-value": "job_value",
  "net-square-feet": "floor_area",
  "Contractor-cert-holder": "qualifier_name",
  "License-number": "contractor_license",
  "company-name": "contractor_company",
  "contact-person": "qualifier_name",
  "contractor-address": "contractor_address",
  "company-city": "contractor_city",
  "company state": "contractor_state",
  "company-zip": "contractor_zip",
  "company-phone": "contractor_phone",
  "company-email": "contractor_email",
  "owner-printed-name": "client_name",
  "contractor-printed-name": "qualifier_name",
  "fee-simple-titleholder-name-1": "fee_simple_titleholder_name",
  "fee-simple-titleholder-city": "fee_simple_city",
  "fee-simple-titleholder-state": "fee_simple_state",
  "fee-simple-titleholder-zip": "fee_simple_zip",
  "bonding-company-name-1": "bonding_company",
  "bonding-company-address-1": "bonding_address",
  "bonding-company-city": "bonding_city",
  "bonding-company-state": "bonding_state",
  "bonding-company-zip": "bonding_zip",
  "design-professional-name-1": "architect_name",
  "design-professional-address-1": "architect_address",
  "design-professional-city": "architect_city",
  "design-professional-state": "architect_state",
  "design-professional-zip": "architect_zip",
  "mortgage-lender-name-1": "mortgage_lender_name",
  "mortgage-lender-address-1": "mortgage_lender_address",
  "mortgage-lender-city": "mortgage_city",
  "mortgage-lender-state": "mortgage_state",
  "mortgage-lender-zip": "mortgage_zip",
  "APPLICATION-DATE": "today_date",
  "PCN-1": "folio_number",
};

/** Official Miami-Dade County Building Permit Application (unincorporated / folio 30). */
export const MIAMI_DADE_UNINCORPORATED_PERMIT_APP: Record<string, string> = {
  "Job Address": "job_address_full",
  Folio: "folio_number",
  "Metes and bounds": "legal_description",
  "Contractor No": "contractor_license",
  "Contractor Name": "contractor_company",
  "Qualifier Name": "qualifier_name",
  "Address: Contractor Information": "contractor_address",
  "City: Contractor Information": "contractor_city",
  "State: Contractor Information": "contractor_state",
  "Zip: Contractor Information": "contractor_zip",
  "Current use of property, line 1": "present_use",
  "Current use of property, line 2": "building_use",
  "Description of Work, line 1": "description_of_work",
  "Sq. Ft": "floor_area",
  "Value of Works": "job_value",
  Owner: "client_name",
  "Address: Property Owner's Information": "job_address_full",
  "City: Property Owner's Information": "job_city",
  "Phone: Property Owner's Information": "owner_phone",
  "Name: Permit Contact": "qualifier_name",
  "Address: Permit Contact": "contractor_address",
  "City: Permit Contact": "contractor_city",
  "Zip: Permit Contact": "contractor_zip",
  "Phone: Permit Contact": "contractor_phone",
  "Name: Architect/Engineer": "architect_name",
  "Address: Architect/Engineer": "architect_address",
  "City: Architect/Engineer": "architect_city",
  "State: Architect/Engineer": "architect_state",
  "Zip: Architect/Engineer 2": "architect_zip",
  "Phone: Architect/Engineer 2": "architect_phone",
  "Name: Bonding": "bonding_company",
  "Address: Bonding": "bonding_address",
  "City: Bonding": "bonding_city",
  "State: Bonding": "bonding_state",
  "Zip: Bonding": "bonding_zip",
  "Name: Mortgage Lander": "mortgage_lender_name",
  "Address: Mortgage Lander": "mortgage_lender_address",
  "City: Mortgage Lander": "mortgage_city",
  "State: Mortgage Lander": "mortgage_state",
  "Zip: Mortgage Lander": "mortgage_zip",
};

export function builtinMappingFor(row: {
  county: string;
  doc_type: string;
  jurisdiction_name: string | null;
  title: string;
}): Record<string, string> | null {
  const city = (row.jurisdiction_name ?? "").trim();
  const title = row.title.toLowerCase();
  const isPermitApp =
    row.doc_type === "permit_application" || title.includes("permit app");

  // Hollywood / Sunrise / etc. reuse the Broward county application fields
  // (legal description is field 31). Do not require an empty city.
  if (row.county === "Broward" && isPermitApp) {
    return BROWARD_COUNTY_PERMIT_APP;
  }
  if (row.county === "Palm Beach" && isPermitApp) {
    return PALM_BEACH_UNIVERSAL_PERMIT_APP;
  }
  const mdUnincorporated =
    !city ||
    /unincorporated|miami-dade county|miami dade county/i.test(city);
  if (row.county === "Miami-Dade" && mdUnincorporated && isPermitApp) {
    return MIAMI_DADE_UNINCORPORATED_PERMIT_APP;
  }
  return null;
}

export function resolveFormFieldMapping(row: {
  county: string;
  doc_type: string;
  jurisdiction_name: string | null;
  title: string;
  field_mapping?: Record<string, string> | null;
}): Record<string, string> {
  const stored = row.field_mapping ?? {};
  const builtin = builtinMappingFor(row) ?? {};
  return { ...builtin, ...stored };
}

export function mergeGuessedMapping(
  pdfFieldNames: string[],
  mapping: Record<string, string>,
): Record<string, string> {
  return ensureHeaderMapping(pdfFieldNames, mapping);
}

export { guessJobDataKey };
