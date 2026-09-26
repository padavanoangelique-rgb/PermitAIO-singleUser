export const CONTRACTOR_DOC_KINDS = [
  { id: "license", label: "License" },
  { id: "btr", label: "BTR" },
  { id: "w9", label: "W-9" },
  { id: "other", label: "Other" },
] as const;

export const COI_COLUMNS = [
  { id: "coi", label: "Liability" },
  { id: "workers_comp", label: "Workers comp" },
] as const;

export type ContractorDocKind =
  | (typeof CONTRACTOR_DOC_KINDS)[number]["id"]
  | (typeof COI_COLUMNS)[number]["id"];

export type CoiKind = (typeof COI_COLUMNS)[number]["id"];

const GENERIC_CITY = /^(coi|liability|general liability|gl|workers?\s*comp.*|wc|insurance|certificate)$/i;

export function guessContractorDocKind(kind: string | null | undefined, label: string | null | undefined): ContractorDocKind {
  if (kind === "coi" || kind === "workers_comp" || kind === "license" || kind === "btr" || kind === "w9" || kind === "other") {
    return kind;
  }
  const n = (label ?? "").toLowerCase();
  if (n.includes("worker") || n.includes("comp") || n.includes("wc")) return "workers_comp";
  if (n.includes("coi") || n.includes("insur") || n.includes("liab")) return "coi";
  if (n.includes("license") || n.includes("lic")) return "license";
  if (n.includes("btr") || n.includes("tax")) return "btr";
  if (n.includes("w-9") || n.includes("w9")) return "w9";
  return "other";
}

export function isCoiKind(kind: string | null | undefined): kind is CoiKind {
  return kind === "coi" || kind === "workers_comp";
}

export function coiCityOf(label: string | null | undefined): string {
  const value = (label ?? "").trim();
  if (!value || GENERIC_CITY.test(value)) return "General";
  return value;
}

export function latestExpiry(dates: Array<string | null | undefined>): string | null {
  let best: string | null = null;
  for (const value of dates) {
    const next = (value ?? "").slice(0, 10);
    if (!next) continue;
    if (!best || next > best) best = next;
  }
  return best;
}

export const DEFAULT_REGISTRATION_SUBJECT = "Contractor registration — {{company}} — {{jurisdiction}}";
export const DEFAULT_REGISTRATION_BODY = `Hello,

Please find contractor registration documents for {{company}}.

License: {{license}}
Qualifier: {{qualifier}}
Contact: {{contact}} {{phone}} {{email}}

{{instructions}}

Thank you,
PermitAIO
`;

export const DEFAULT_UPDATE_SUBJECT = "Updated contractor documents — {{company}}";
export const DEFAULT_UPDATE_BODY = `Hello,

Attached are updated documents for {{company}} (license {{license}}).

Please replace any expired copies on file.

Thank you,
{{contact}}
{{phone}}
`;

export const DEFAULT_NOC_SUBJECT = "Notice of Commencement — {{company}}";
export const DEFAULT_NOC_BODY = `Hello,

Please upload the recorded Notice of Commencement for {{company}} using this link:

{{noc_link}}

If you already have the recorded NOC, reply to this email with the PDF attached.

Thank you,
PermitAIO
`;

export function fillContractorTemplate(
  template: string,
  vars: Record<string, string | null | undefined>,
) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? "");
}
