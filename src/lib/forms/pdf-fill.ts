import { PDFDocument, PDFTextField, PDFCheckBox, PDFDropdown, PDFRadioGroup } from "pdf-lib";
import {
  BROWARD_COUNTY_PERMIT_APP,
  PALM_BEACH_UNIVERSAL_PERMIT_APP,
  MIAMI_DADE_UNINCORPORATED_PERMIT_APP,
  mergeGuessedMapping,
} from "@/lib/forms/builtin-field-maps";

export const JOB_DATA_FIELDS = [
  { key: "job_number", label: "Job Number" },
  { key: "client_name", label: "Client / Owner Name" },
  { key: "job_address", label: "Job Address" },
  { key: "job_address_full", label: "Job Address (full)" },
  { key: "job_unit", label: "Unit / Suite" },
  { key: "job_city", label: "Job Site City" },
  { key: "jurisdiction", label: "Jurisdiction / Municipality" },
  { key: "folio_number", label: "Folio / Parcel Number" },
  { key: "permit_number", label: "Permit Number" },
  { key: "job_value", label: "Job Value / Contract Value" },
  { key: "today_date", label: "Today's Date" },
  { key: "owner_phone", label: "Property Owner Phone" },
  { key: "owner_email", label: "Property Owner Email" },
  { key: "legal_description", label: "Legal Description" },
  { key: "flood_zone", label: "Flood Zone" },
  { key: "bfe", label: "BFE (Base Flood Elevation)" },
  { key: "floor_area", label: "Floor Area" },
  { key: "building_use", label: "Building Use" },
  { key: "construction_type", label: "Construction Type" },
  { key: "occupancy_group", label: "Occupancy Group" },
  { key: "present_use", label: "Present Use" },
  { key: "proposed_use", label: "Proposed Use" },
  { key: "description_of_work", label: "Description of Work" },
  { key: "work_type", label: "Work Type (New/Addition/Repair/etc.)" },
  { key: "contractor_company", label: "Contractor Company Name" },
  { key: "contractor_phone", label: "Contractor Phone" },
  { key: "contractor_email", label: "Contractor Email" },
  { key: "contractor_address", label: "Contractor Address" },
  { key: "contractor_city", label: "Contractor City" },
  { key: "contractor_state", label: "Contractor State" },
  { key: "contractor_zip", label: "Contractor Zip" },
  { key: "contractor_license", label: "Contractor License Number" },
  { key: "qualifier_name", label: "Qualifier's Name" },
  { key: "business_tax_receipt_number", label: "Business Tax Receipt Number" },
  { key: "bonding_company", label: "Bonding Company" },
  { key: "bonding_address", label: "Bonding Company Address" },
  { key: "bonding_city", label: "Bonding Company City" },
  { key: "bonding_state", label: "Bonding Company State" },
  { key: "bonding_zip", label: "Bonding Company Zip" },
  { key: "architect_name", label: "Architect/Engineer Name" },
  { key: "architect_phone", label: "Architect/Engineer Phone" },
  { key: "architect_email", label: "Architect/Engineer Email" },
  { key: "architect_address", label: "Architect/Engineer Address" },
  { key: "architect_city", label: "Architect/Engineer City" },
  { key: "architect_state", label: "Architect/Engineer State" },
  { key: "architect_zip", label: "Architect/Engineer Zip" },
  { key: "fee_simple_titleholder_name", label: "Fee Simple Titleholder Name" },
  { key: "fee_simple_city", label: "Fee Simple Titleholder City" },
  { key: "fee_simple_state", label: "Fee Simple Titleholder State" },
  { key: "fee_simple_zip", label: "Fee Simple Titleholder Zip" },
  { key: "mortgage_lender_name", label: "Mortgage Lender Name" },
  { key: "mortgage_lender_address", label: "Mortgage Lender Address" },
  { key: "mortgage_city", label: "Mortgage Lender City" },
  { key: "mortgage_state", label: "Mortgage Lender State" },
  { key: "mortgage_zip", label: "Mortgage Lender Zip" },
] as const;

export type JobDataKey = (typeof JOB_DATA_FIELDS)[number]["key"];

export interface DetectedPdfField {
  name: string;
  type: string;
}

function toUint8(bytes: Uint8Array | ArrayBuffer): Uint8Array {
  return bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
}

async function loadPdfLenient(bytes: Uint8Array | ArrayBuffer): Promise<PDFDocument> {
  try {
    return await PDFDocument.load(bytes, { ignoreEncryption: true });
  } catch (err) {
    try {
      return await PDFDocument.load(bytes, {
        ignoreEncryption: true,
        throwOnInvalidObject: false,
        updateMetadata: false,
      });
    } catch {
      throw err;
    }
  }
}

function describeFieldType(field: unknown): string {
  if (field instanceof PDFTextField) return "PDFTextField";
  if (field instanceof PDFCheckBox) return "PDFCheckBox";
  if (field instanceof PDFDropdown) return "PDFDropdown";
  if (field instanceof PDFRadioGroup) return "PDFRadioGroup";
  return "Other";
}

export async function listPdfFormFields(bytes: Uint8Array | ArrayBuffer): Promise<DetectedPdfField[]> {
  try {
    const doc = await loadPdfLenient(bytes);
    const form = doc.getForm();
    return form.getFields().map((f) => ({ name: f.getName(), type: describeFieldType(f) }));
  } catch {
    return [];
  }
}

export interface FillDiagnostics {
  mappingCount: number;
  skippedEmpty: number;
  attempted: number;
  filled: number;
  fieldErrors: { pdfFieldName: string; dataKey: string; error: string }[];
  appearanceError: string | null;
  fatalError?: string;
}

function withBuiltinAndGuessed(
  pdfFieldNames: string[],
  fieldMapping: Record<string, string>,
): Record<string, string> {
  const names = new Set(pdfFieldNames);
  let mapping = { ...fieldMapping };
  if (names.has("12") && names.has("33") && names.has("36")) {
    mapping = { ...BROWARD_COUNTY_PERMIT_APP, ...mapping };
  } else if (names.has("Property_Owner") && names.has("Project-address")) {
    mapping = { ...PALM_BEACH_UNIVERSAL_PERMIT_APP, ...mapping };
  } else if (names.has("Job Address") && names.has("Folio") && names.has("Value of Works")) {
    mapping = { ...MIAMI_DADE_UNINCORPORATED_PERMIT_APP, ...mapping };
  }
  return mergeGuessedMapping(pdfFieldNames, mapping);
}

function withFullAddress(
  values: Partial<Record<JobDataKey, string>>,
): Partial<Record<JobDataKey, string>> {
  if (values.job_address_full) return values;
  const full = [values.job_address, values.job_unit, values.job_city].filter(Boolean).join(", ");
  return { ...values, job_address_full: full };
}

export async function fillPdfForm(
  bytes: Uint8Array | ArrayBuffer,
  fieldMapping: Record<string, string>,
  values: Partial<Record<JobDataKey, string>>,
): Promise<{ bytes: Uint8Array; diagnostics: FillDiagnostics }> {
  const original = toUint8(bytes);
  const empty: FillDiagnostics = {
    mappingCount: 0,
    skippedEmpty: 0,
    attempted: 0,
    filled: 0,
    fieldErrors: [],
    appearanceError: null,
  };
  try {
    const doc = await loadPdfLenient(original);
    let form;
    let pdfFieldNames: string[] = [];
    try {
      form = doc.getForm();
      pdfFieldNames = form.getFields().map((f) => f.getName());
    } catch (err) {
      return {
        bytes: original,
        diagnostics: {
          ...empty,
          fatalError: err instanceof Error ? err.message : String(err),
        },
      };
    }
    const effectiveMapping = withBuiltinAndGuessed(pdfFieldNames, fieldMapping);
    const filledValues = withFullAddress(values);
    const diagnostics: FillDiagnostics = {
      mappingCount: Object.keys(effectiveMapping).length,
      skippedEmpty: 0,
      attempted: 0,
      filled: 0,
      fieldErrors: [],
      appearanceError: null,
    };

    for (const [pdfFieldName, dataKey] of Object.entries(effectiveMapping)) {
      const value = filledValues[dataKey as JobDataKey];
      if (value == null || value === "") {
        diagnostics.skippedEmpty += 1;
        continue;
      }
      diagnostics.attempted += 1;
      try {
        const field = form.getField(pdfFieldName);
        if (field instanceof PDFTextField) {
          field.setText(String(value));
          diagnostics.filled += 1;
        } else if (field instanceof PDFCheckBox) {
          const truthy = String(value).toLowerCase() === "true" || value === "1";
          if (truthy) field.check();
          diagnostics.filled += 1;
        } else if (field instanceof PDFDropdown || field instanceof PDFRadioGroup) {
          try {
            field.select(String(value));
            diagnostics.filled += 1;
          } catch (err) {
            diagnostics.fieldErrors.push({
              pdfFieldName,
              dataKey,
              error: `option not on field: ${err instanceof Error ? err.message : String(err)}`,
            });
          }
        }
      } catch (err) {
        diagnostics.fieldErrors.push({
          pdfFieldName,
          dataKey,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    try {
      form.updateFieldAppearances();
    } catch (err) {
      diagnostics.appearanceError = err instanceof Error ? err.message : String(err);
    }

    try {
      return { bytes: await doc.save(), diagnostics };
    } catch (err) {
      return {
        bytes: original,
        diagnostics: {
          ...diagnostics,
          fatalError: err instanceof Error ? err.message : String(err),
        },
      };
    }
  } catch (err) {
    return {
      bytes: original,
      diagnostics: {
        ...empty,
        fatalError: err instanceof Error ? err.message : String(err),
      },
    };
  }
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export function downloadBytes(bytes: Uint8Array, fileName: string) {
  const blob = new Blob([bytes.slice().buffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
