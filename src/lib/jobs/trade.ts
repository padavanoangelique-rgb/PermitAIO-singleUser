/**
 * Trade-type classification shared across PermitAIO.
 *
 * `jobs.trade_type` is free text so it stays compatible with data migrated
 * from the original Permit Inventory tool, where the trade dropdown used
 * values like "Win", "Windows", "Tile", "Metal", "Shingle", and "Roof"
 * rather than a fixed enum. New jobs created in PermitAIO use the cleaner
 * canonical values below, but every reader in the app normalizes through
 * this file so historical rows still classify, badge, and match correctly
 * without ever having to rewrite the stored trade_type value.
 */

export type TradeFamily = "windows" | "roofing" | "general";
export type RoofCoveringType = "tile" | "shingle" | "metal";

export const ROOF_COVERING_TYPES: { value: RoofCoveringType; label: string }[] = [
  { value: "tile", label: "Tile" },
  { value: "shingle", label: "Shingle" },
  { value: "metal", label: "Metal" },
];

export const NEW_JOB_TRADE_OPTIONS: { value: string; label: string }[] = [
  { value: "windows", label: "Windows" },
  { value: "tile", label: "Tile Roofing" },
  { value: "shingle", label: "Shingle Roofing" },
  { value: "metal", label: "Metal Roofing" },
  { value: "general", label: "General" },
];

function norm(raw: string | null | undefined): string {
  return (raw ?? "").trim().toLowerCase();
}

/** Buckets any historical or new trade_type string into windows / roofing / general. */
export function normalizeTradeFamily(raw: string | null | undefined): TradeFamily {
  const v = norm(raw);
  if (!v || v === "general") return "general";
  if (v.startsWith("win")) return "windows"; // "windows", "Win", "windows"
  if (v.startsWith("roof") || v === "tile" || v === "shingle" || v === "metal") return "roofing";
  return "general";
}

export function isRoofingTrade(raw: string | null | undefined): boolean {
  return normalizeTradeFamily(raw) === "roofing";
}

/** Extracts the specific roof covering type when the trade_type already names one. */
export function roofCoveringFromTrade(raw: string | null | undefined): RoofCoveringType | null {
  const v = norm(raw);
  if (v === "tile") return "tile";
  if (v === "shingle") return "shingle";
  if (v === "metal") return "metal";
  return null;
}

const FAMILY_LABELS: Record<TradeFamily, string> = {
  windows: "Windows",
  roofing: "Roofing",
  general: "General",
};

const COVERING_LABELS: Record<RoofCoveringType, string> = {
  tile: "Tile",
  shingle: "Shingle",
  metal: "Metal",
};

/** Human-friendly badge label — prefers a known covering type, falls back to the family name. */
export function tradeLabel(raw: string | null | undefined): string {
  if (!raw) return "General";
  const covering = roofCoveringFromTrade(raw);
  if (covering) return COVERING_LABELS[covering];
  return FAMILY_LABELS[normalizeTradeFamily(raw)];
}

const FAMILY_BADGE_CLASS: Record<TradeFamily, string> = {
  windows: "bg-chart-1/15 text-chart-1 border-chart-1/30",
  roofing: "bg-chart-2/15 text-chart-2 border-chart-2/30",
  general: "bg-muted text-muted-foreground border-transparent",
};

export function tradeBadgeClass(raw: string | null | undefined): string {
  return FAMILY_BADGE_CLASS[normalizeTradeFamily(raw)];
}

/** Contractor profiles only ever use the binary "windows" | "roofing" trade field. */
export function contractorTradeFamily(raw: string | null | undefined): "windows" | "roofing" | null {
  const family = normalizeTradeFamily(raw);
  return family === "general" ? null : family;
}

export const ROOFING_COMPONENT_TYPES_BY_COVERING: Record<
  RoofCoveringType,
  { value: string; label: string }[]
> = {
  tile: [
    { value: "tile", label: "Tile" },
    { value: "underlayment", label: "Underlayment" },
    { value: "foam", label: "Adhesive / Foam" },
  ],
  shingle: [
    { value: "shingle", label: "Shingle" },
    { value: "underlayment", label: "Underlayment" },
  ],
  metal: [
    { value: "metal_panel", label: "Metal Panel" },
    { value: "underlayment", label: "Underlayment" },
  ],
};

export const ROOFING_COMPONENT_TYPE_LABELS: Record<string, string> = {
  tile: "Tile",
  underlayment: "Underlayment",
  foam: "Adhesive / Foam",
  shingle: "Shingle",
  metal_panel: "Metal Panel",
  fasteners: "Fasteners",
};

export const ROOF_SHAPES: { value: string; label: string }[] = [
  { value: "hip", label: "Hip" },
  { value: "gable", label: "Gable" },
  { value: "flat", label: "Flat" },
  { value: "other", label: "Other" },
];
