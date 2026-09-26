/**
 * Fence permit rules — jurisdictions, permit-path router, document checklist,
 * validations, and inspections for the Fence Permit Package tool.
 *
 * Sourcing note: the jurisdiction list and the permit-path hints below reflect
 * what's been confirmed so far (Angelique's jurisdiction notes). Anything not
 * explicitly confirmed is written conservatively — never claims a fence is
 * exempt from permitting unless a specific, named threshold applies — and is
 * flagged with a TODO so it's easy to find and tighten once the full brief
 * (PERMITAIO-FENCE-BUILDER-BRIEF.md / COS-FENCE-BUILDER-SUMMARY.md) is
 * available to source exact numbers, forms, and portal URLs against.
 */

export type Pt = { x: number; y: number };

export type FenceLocation = "front" | "side" | "rear" | "corner_side";

export const FENCE_LOCATIONS: { value: FenceLocation; label: string }[] = [
  { value: "front", label: "Front yard" },
  { value: "side", label: "Side yard" },
  { value: "rear", label: "Rear yard" },
  { value: "corner_side", label: "Corner side (2nd street frontage)" },
];

export const FENCE_MATERIALS: { value: string; label: string; needsProductApproval?: boolean }[] = [
  { value: "wood", label: "Wood" },
  { value: "chain_link", label: "Chain link" },
  { value: "aluminum", label: "Aluminum picket", needsProductApproval: true },
  { value: "pvc", label: "PVC / vinyl", needsProductApproval: true },
  { value: "wrought_iron", label: "Wrought iron / ornamental metal", needsProductApproval: true },
  { value: "concrete_masonry", label: "Concrete / masonry wall" },
  { value: "other", label: "Other" },
];

export type FenceJurisdictionId =
  | "mdc"
  | "miami"
  | "pbc"
  | "boca_raton"
  | "wellington"
  | "broward"
  | "davie"
  | "pompano_beach";

export const FENCE_JURISDICTIONS: {
  id: FenceJurisdictionId;
  label: string;
  county: "Miami-Dade" | "Broward" | "Palm Beach";
  matchHints: string[];
}[] = [
  { id: "mdc", label: "Miami-Dade County (unincorporated)", county: "Miami-Dade", matchHints: ["miami-dade", "miami dade", "unincorporated"] },
  { id: "miami", label: "City of Miami", county: "Miami-Dade", matchHints: ["miami", "city of miami"] },
  { id: "broward", label: "Broward County (unincorporated)", county: "Broward", matchHints: ["broward"] },
  { id: "davie", label: "Davie", county: "Broward", matchHints: ["davie"] },
  { id: "pompano_beach", label: "Pompano Beach", county: "Broward", matchHints: ["pompano"] },
  { id: "pbc", label: "Palm Beach County (unincorporated)", county: "Palm Beach", matchHints: ["palm beach county", "palm beach", "unincorporated"] },
  { id: "boca_raton", label: "Boca Raton", county: "Palm Beach", matchHints: ["boca"] },
  { id: "wellington", label: "Wellington", county: "Palm Beach", matchHints: ["wellington"] },
];

export function fenceJurisdiction(id: FenceJurisdictionId): {
  id: FenceJurisdictionId;
  label: string;
  county: string;
  /** TODO: fill in each AHJ's real permitting-portal URL once sourced — never guessed. */
  portal: { label: string; url: string } | null;
} {
  const j = FENCE_JURISDICTIONS.find((x) => x.id === id) ?? FENCE_JURISDICTIONS[0];
  return { id: j.id, label: j.label, county: j.county, portal: null };
}

/** Matches a job's free-text jurisdiction/city against the known list; defaults to Miami-Dade unincorporated. */
export function guessFenceJurisdiction(jurisdictionRaw: string | null | undefined, city: string | null | undefined): FenceJurisdictionId {
  const hay = `${jurisdictionRaw ?? ""} ${city ?? ""}`.trim().toLowerCase();
  if (!hay) return "mdc";
  for (const j of FENCE_JURISDICTIONS) {
    if (j.matchHints.some((h) => hay.includes(h))) return j.id;
  }
  return "mdc";
}

export type FenceProject = {
  jurisdiction: FenceJurisdictionId;
  use: "residential" | "commercial";
  applicant: "contractor" | "owner_builder";
  action: "new" | "replace" | "repair";
  material: string;
  default_height_ft: number;
  job_value: number | null;
  product_approval: string;
  survey_date: string;
  min_setback_ft: number | null;
  pool_on_site: boolean;
  is_pool_barrier: boolean;
  on_easement: boolean;
  sunshine_ticket: string;
  hoa: boolean;
  in_sight_triangle: boolean;
  finished_side_out: boolean;
  height_extension_plus2: boolean;
  existing_permitted: boolean;
  zero_lot_line_or_safe_corner: boolean;
  over_20_percent_of_section: boolean;
};

export const DEFAULT_FENCE_PROJECT: FenceProject = {
  jurisdiction: "mdc",
  use: "residential",
  applicant: "contractor",
  action: "new",
  material: "aluminum",
  default_height_ft: 6,
  job_value: null,
  product_approval: "",
  survey_date: "",
  min_setback_ft: null,
  pool_on_site: false,
  is_pool_barrier: false,
  on_easement: false,
  sunshine_ticket: "",
  hoa: false,
  in_sight_triangle: false,
  finished_side_out: true,
  height_extension_plus2: false,
  existing_permitted: false,
  zero_lot_line_or_safe_corner: false,
  over_20_percent_of_section: false,
};

export type FenceRun = {
  id: string;
  points: Pt[];
  closed: boolean;
  height_ft: number;
  location: FenceLocation;
};

export type FenceGate = {
  id: string;
  runId: string;
  segment: number;
  t: number;
  width_ft: number;
  swing: "in" | "out" | "sliding";
  electrical: boolean;
};

export function segLen(a: Pt, b: Pt): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Consecutive point-pairs for a run, closing the loop when `closed` is set. */
export function runSegments(run: FenceRun): [Pt, Pt][] {
  const segs: [Pt, Pt][] = [];
  for (let i = 0; i < run.points.length - 1; i++) segs.push([run.points[i], run.points[i + 1]]);
  if (run.closed && run.points.length > 2) segs.push([run.points[run.points.length - 1], run.points[0]]);
  return segs;
}

export type FenceTotals = {
  linear_ft: number | null;
  max_height_ft: number | null;
  gate_count: number;
  gate_ft: number;
  locations: FenceLocation[];
};

export function computeTotals(runs: FenceRun[], gates: FenceGate[], ppf: number | null): FenceTotals {
  const realRuns = runs.filter((r) => r.points.length > 1);
  let linear_ft: number | null = null;
  if (ppf) {
    let px = 0;
    for (const run of realRuns) for (const [a, b] of runSegments(run)) px += segLen(a, b);
    linear_ft = Math.round((px / ppf) * 10) / 10;
  }
  const max_height_ft = realRuns.length ? Math.max(...realRuns.map((r) => r.height_ft)) : null;
  const locations = Array.from(new Set(realRuns.map((r) => r.location)));
  return {
    linear_ft,
    max_height_ft,
    gate_count: gates.length,
    gate_ft: Math.round(gates.reduce((s, g) => s + g.width_ft, 0) * 10) / 10,
    locations,
  };
}

/** "4.5" -> `4'-6"` */
export function formatFeet(ft: number): string {
  const whole = Math.floor(ft + 1e-9);
  const inches = Math.round((ft - whole) * 12);
  return inches === 0 ? `${whole}'-0"` : inches === 12 ? `${whole + 1}'-0"` : `${whole}'-${inches}"`;
}

export type FencePath = { title: string; reason: string; exempt: boolean };

/**
 * Routes to a permit path per jurisdiction. Framed conservatively: a permit
 * is assumed required unless a specific, named exemption applies (currently
 * only PBC's $1,000 value threshold, per Angelique's note). Every other
 * jurisdiction-specific distinction called out below (MDC's ZIP vs. Building
 * review track, PBC's SPR vs. T1 track) is named but the exact routing
 * criteria still needs the brief — confirm before relying on it.
 */
export function fencePermitPath(project: FenceProject): FencePath {
  const juris = fenceJurisdiction(project.jurisdiction);

  if (project.jurisdiction === "pbc" && project.job_value != null && project.job_value <= 1000 && project.action !== "new") {
    return {
      title: "May be exempt — PBC $1,000 value threshold",
      reason:
        "Palm Beach County unincorporated exempts some minor repair work valued at $1,000 or less from permitting. Confirm this job qualifies (scope, material, and whether the fence is a pool barrier) before treating it as exempt — pool barriers are never exempt.",
      exempt: !project.is_pool_barrier,
    };
  }

  if (project.jurisdiction === "pbc") {
    return {
      title: project.use === "commercial" ? "Building permit — Site Plan Review (SPR) may apply" : "Building permit — T1 (trade) track",
      reason:
        "Palm Beach County unincorporated: residential fences typically route through the T1 building-permit track; commercial/multifamily work may also require Site Plan Review (SPR). Confirm the current SPR trigger criteria with PBC PZ&B before submitting.",
      exempt: false,
    };
  }

  if (project.jurisdiction === "mdc") {
    return {
      title: "Building permit — confirm ZIP vs. standard Building track",
      reason:
        "Miami-Dade County unincorporated reviews some fence work through the ZIP (Zoning Inspection Permit) track and other work through the standard Building permit track. TODO: confirm the exact criteria (material, height, HVHZ product approval) against the sourced brief before routing automatically.",
      exempt: false,
    };
  }

  return {
    title: "Building permit required",
    reason: `Fence and wall work in ${juris.label} requires a building permit under the Florida Building Code as locally adopted. TODO: confirm ${juris.label}'s specific fence ordinance (height limits by yard, setback, and any repair-value exemption) against the sourced brief.`,
    exempt: false,
  };
}

export type FenceDoc = { title: string; url?: string; note?: string; kind: "required" | "if_applicable" };

/** Per Angelique: the main forms across jurisdictions are the same — a building permit application and a Notice of Commencement. */
export function fenceDocuments(project: FenceProject, totals: FenceTotals): FenceDoc[] {
  const path = fencePermitPath(project);
  if (path.exempt) {
    return [{ title: "Keep this determination with the job file", note: "No permit application required under the exemption above.", kind: "required" }];
  }

  const docs: FenceDoc[] = [
    { title: "Building permit application", note: "Same core form across jurisdictions — the local AHJ's building permit application.", kind: "required" },
  ];

  if ((project.job_value ?? 0) > 2500) {
    docs.push({
      title: "Notice of Commencement (NOC)",
      note: "Required for job value over $2,500 (Fla. Stat. § 713.13), recorded with the county and posted at the job site.",
      kind: "required",
    });
  } else {
    docs.push({
      title: "Notice of Commencement (NOC)",
      note: "Only required if job value exceeds $2,500 (Fla. Stat. § 713.13).",
      kind: "if_applicable",
    });
  }

  docs.push({ title: "Signed & sealed survey showing the proposed fence location", kind: "required" });

  const mat = FENCE_MATERIALS.find((m) => m.value === project.material);
  if (mat?.needsProductApproval) {
    docs.push({
      title: "NOA / Florida Product Approval for the fence system",
      note: project.product_approval ? `On file: ${project.product_approval}` : "Manufactured panel systems need product approval, especially in HVHZ (Miami-Dade/Broward).",
      kind: "required",
    });
  }

  if (project.applicant === "owner_builder") {
    docs.push({ title: "Owner-builder affidavit", kind: "required" });
  } else {
    docs.push({ title: "Contractor license & certificate of insurance", kind: "required" });
  }

  if (project.is_pool_barrier) {
    docs.push({
      title: "Pool safety barrier compliance affidavit",
      note: "Fla. Stat. § 515.27 — self-closing/self-latching gate hardware, no openings a 4\" sphere can pass through.",
      kind: "required",
    });
  } else if (project.pool_on_site) {
    docs.push({ title: "Confirm the pool's own safety barrier is unaffected by this work", kind: "if_applicable" });
  }

  if (project.hoa) docs.push({ title: "HOA / condo association approval letter", kind: "required" });

  if (project.on_easement) {
    docs.push({
      title: "Easement encroachment acknowledgement",
      note: project.sunshine_ticket ? `Sunshine 811 ticket: ${project.sunshine_ticket}` : "Call 811 (Sunshine State One Call) before digging in a utility/drainage easement.",
      kind: "required",
    });
  }

  if (project.jurisdiction === "pbc" && project.use === "commercial") {
    docs.push({ title: "Site Plan Review (SPR) documentation, if triggered", kind: "if_applicable" });
  }

  if (totals.gate_count > 0) {
    docs.push({ title: "Gate hardware / operator spec sheet", note: "Especially for electric gate operators.", kind: "if_applicable" });
  }

  return docs;
}

export type FenceWarning = { level: "error" | "warn" | "info"; text: string; source: string };

export function fenceWarnings(project: FenceProject, totals: FenceTotals, runs: FenceRun[]): FenceWarning[] {
  const warnings: FenceWarning[] = [];

  if (project.is_pool_barrier) {
    warnings.push({
      level: "warn",
      text: "Pool barrier fences need self-closing/self-latching gate hardware and no gaps a 4\" sphere can pass through.",
      source: "Fla. Stat. § 515.27",
    });
  } else if (project.pool_on_site) {
    warnings.push({
      level: "warn",
      text: "There's a pool on the property. Confirm a code-compliant barrier surrounds the entire pool area independent of this fence.",
      source: "Fla. Stat. § 515.27",
    });
  }

  if (project.on_easement && !project.sunshine_ticket) {
    warnings.push({ level: "error", text: "Fence is in an easement but no Sunshine 811 ticket is on file. Call 811 before digging.", source: "Sunshine 811" });
  }

  if (project.in_sight_triangle) {
    warnings.push({
      level: "warn",
      text: "Part of the fence is in a sight triangle or near a driveway. Confirm the jurisdiction's clearance requirement — heights are usually restricted there.",
      source: `${fenceJurisdiction(project.jurisdiction).label} code`,
    });
  }

  if (project.hoa) {
    warnings.push({ level: "info", text: "HOA/condo approval is marked required — get the approval letter before starting work.", source: "Project details" });
  }

  const realRuns = runs.filter((r) => r.points.length > 1);
  const frontRuns = realRuns.filter((r) => r.location === "front" || r.location === "corner_side");
  if (frontRuns.some((r) => r.height_ft > 4)) {
    warnings.push({
      level: "warn",
      text: "A front-yard or corner-side run is over 4 ft. Most Florida residential codes cap front-yard fence height lower than rear/side — confirm against the jurisdiction's code.",
      source: `${fenceJurisdiction(project.jurisdiction).label} code`,
    });
  }
  if (project.use === "residential" && realRuns.some((r) => r.location !== "front" && r.location !== "corner_side" && r.height_ft > 6 && !project.height_extension_plus2)) {
    warnings.push({
      level: "warn",
      text: "A rear/side run is over 6 ft without the +2 ft extension marked. Most residential fences cap at 6 ft without an extension/affidavit — confirm.",
      source: `${fenceJurisdiction(project.jurisdiction).label} code`,
    });
  }

  if (project.min_setback_ft != null) {
    warnings.push({
      level: "info",
      text: `Closest setback entered: ${formatFeet(project.min_setback_ft)}. Confirm the jurisdiction's required minimum setback from the property line — this tool doesn't check that number.`,
      source: `${fenceJurisdiction(project.jurisdiction).label} code`,
    });
  }

  if (project.jurisdiction === "wellington" && project.action === "repair" && project.over_20_percent_of_section) {
    warnings.push({
      level: "warn",
      text: "Repair marked as more than 20% of a fence section — Wellington may treat this as replacement rather than repair for permitting purposes.",
      source: "Wellington code",
    });
  }

  if (project.jurisdiction === "pbc" && project.action !== "new" && project.existing_permitted === false) {
    warnings.push({
      level: "info",
      text: "Existing fence isn't marked as previously permitted. If no permit exists on file, this job may need to be submitted as new work rather than repair/replace.",
      source: "PBC PZ&B",
    });
  }

  if (project.zero_lot_line_or_safe_corner) {
    warnings.push({
      level: "warn",
      text: "Zero-lot-line or safe-site-corner lot — confirm any special fence placement/height rule that applies to this lot type.",
      source: `${fenceJurisdiction(project.jurisdiction).label} code`,
    });
  }

  warnings.push({
    level: "info",
    text: "This tool is a field planning aid, not code advice. Verify permit-path routing, exact height/setback limits, and document requirements with the jurisdiction before submitting.",
    source: "PermitAIO",
  });

  return warnings;
}

export function fenceInspections(project: FenceProject): string[] {
  const list = ["Post-hole / footing inspection (if required by the jurisdiction)", "Final fence inspection"];
  if (project.is_pool_barrier) list.push("Pool barrier final inspection");
  return list;
}
