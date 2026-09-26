export const HOA_DOC_KINDS = [
  { id: "application", label: "HOA application" },
  { id: "blank_form", label: "Blank form" },
  { id: "coi", label: "Certificate of insurance" },
  { id: "certificate", label: "Certificate" },
  { id: "other", label: "Other" },
] as const;

export type HoaDocKind = (typeof HOA_DOC_KINDS)[number]["id"];

const KIND_SET = new Set<string>(HOA_DOC_KINDS.map((k) => k.id));

function safeName(name: string) {
  return name.replace(/[^\w.\-]+/g, "_").slice(0, 80);
}

export function hoaDocPath(args: {
  orgId: string;
  hoaId: string;
  kind: HoaDocKind;
  fileName: string;
  jobId?: string | null;
}) {
  const stamp = Date.now();
  const file = `${stamp}-${safeName(args.fileName)}`;
  if (args.jobId) return `${args.orgId}/${args.hoaId}/jobs/${args.jobId}/${args.kind}/${file}`;
  return `${args.orgId}/${args.hoaId}/${args.kind}/${file}`;
}

export function hoaDocKindFromPath(path: string): HoaDocKind {
  const parts = path.split("/");
  const jobsAt = parts.indexOf("jobs");
  if (jobsAt >= 0) {
    const kind = parts[jobsAt + 2];
    if (kind && KIND_SET.has(kind)) return kind as HoaDocKind;
  }
  const kind = parts[2];
  if (kind && KIND_SET.has(kind)) return kind as HoaDocKind;
  return "other";
}

export function hoaDocJobIdFromPath(path: string): string | null {
  const parts = path.split("/");
  const jobsAt = parts.indexOf("jobs");
  if (jobsAt >= 0 && parts[jobsAt + 1]) return parts[jobsAt + 1];
  return null;
}

export function hoaDocKindLabel(kind: HoaDocKind) {
  return HOA_DOC_KINDS.find((k) => k.id === kind)?.label ?? "Other";
}
