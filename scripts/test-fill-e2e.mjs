// E2E: local fill test against real Broward template + real Alba job data
// Verifies the new FillDiagnostics behavior end-to-end without touching prod.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { PDFDocument } from "pdf-lib";
import { fillPdfForm } from "../src/lib/forms/pdf-fill.ts";

const OUT_DIR = "/tmp/e2e-out";
mkdirSync(OUT_DIR, { recursive: true });

// Real Broward template pulled from production Supabase
const templateBytes = readFileSync("/tmp/broward-template.pdf");

// Real field_mapping row 07a39801-... from production
const fieldMapping = {
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

// Real Alba job + Guardian contractor values (build.ts would compute these)
const values = {
  job_number: "85508",
  client_name: "DIAZ, alba",
  job_address: "123 test",
  job_city: "Sunrise",
  jurisdiction: "Sunrise",
  job_value: "19000.0",
  today_date: new Date().toLocaleDateString("en-US"),
  flood_zone: "N/A",
  bfe: "N/A",
  construction_type: "N/A",
  occupancy_group: "N/A",
  contractor_company: "Guardian Impact Windows And Roofing",
  contractor_phone: "7866548273",
  contractor_email: "permits@guardwhatmatters.com",
  contractor_address: "1489 NW 161 Ave",
  contractor_city: "Pembroke Pines",
  contractor_state: "FL",
  contractor_zip: "33028",
  qualifier_name: "Liliana Roman",
  contractor_license: "CGC1524314",
  business_tax_receipt_number: "180-337518",
};

console.log("Template bytes:", templateBytes.length);
console.log("Mapping entries:", Object.keys(fieldMapping).length);
console.log("Value keys present:", Object.keys(values).length);

// First, list actual PDF form fields so we can compare to the mapping
const preDoc = await PDFDocument.load(templateBytes, { ignoreEncryption: true });
const preForm = preDoc.getForm();
const detectedFields = preForm.getFields().map((f) => ({
  name: f.getName(),
  type: f.constructor.name,
}));
console.log("\n=== Detected PDF form fields (%d) ===", detectedFields.length);
for (const f of detectedFields) console.log("  ", f.name, "->", f.type);

// Now run the real fill
const { bytes: filledBytes, diagnostics } = await fillPdfForm(
  new Uint8Array(templateBytes),
  fieldMapping,
  values,
);

console.log("\n=== FillDiagnostics ===");
console.log(JSON.stringify(diagnostics, null, 2));

writeFileSync(`${OUT_DIR}/filled.pdf`, filledBytes);
writeFileSync(
  `${OUT_DIR}/DEBUG_READ_ME.json`,
  JSON.stringify(
    {
      template: "07a39801-ce8e-4227-bc22-3ded006eae48 (Broward Building Permit App)",
      job: "74e4e97b-... Alba #85508",
      detectedFields,
      mappingSampleKeys: Object.keys(fieldMapping).slice(0, 10),
      diagnostics,
    },
    null,
    2,
  ),
);

// Verify what actually got filled in the saved PDF
const postDoc = await PDFDocument.load(filledBytes, { ignoreEncryption: true });
const postForm = postDoc.getForm();
const nonEmptyFilled = [];
for (const f of postForm.getFields()) {
  if (f.constructor.name === "PDFTextField") {
    const t = f.getText?.();
    if (t) nonEmptyFilled.push({ name: f.getName(), text: t });
  }
}
console.log("\n=== Non-empty text fields in FILLED PDF (%d) ===", nonEmptyFilled.length);
for (const f of nonEmptyFilled) console.log("  ", f.name, "=", f.text);

console.log("\nWrote:", `${OUT_DIR}/filled.pdf`, `${OUT_DIR}/DEBUG_READ_ME.json`);
