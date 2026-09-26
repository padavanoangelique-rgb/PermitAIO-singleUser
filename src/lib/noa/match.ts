/**
 * Matches a job's floor-plan window/door schedule (and mullions) against the
 * org's NOA library so the NOA Downloader tab can show, per opening, whether
 * the manufacturer/series it uses already has a Notice of Acceptance on
 * file — and let the user grab exactly the PDFs this job needs.
 *
 * Matching is intentionally loose (trimmed, case-insensitive manufacturer +
 * series equality) since floor-plan entries and library entries are typed by
 * hand in two different tools. It never changes floor-plan or NOA library
 * data — it's a read-only lookup layer.
 */

import { normalizeTradeFamily, roofCoveringFromTrade } from "@/lib/jobs/trade";

export interface FloorPlanWindow {
  id: string | number;
  location?: string | null;
  manufacturer?: string | null;
  series?: string | null;
  productApproval?: string | null;
  type?: string | null;
}

export interface FloorPlanMullion {
  id: string | number;
  size?: string | null;
  /** Legacy field. The floor plan editor now stores the picked NOA / FL # in `noaNumber`. */
  flNumber?: string | null;
  noaNumber?: string | null;
  mfr?: string | null;
  designPressure?: string | null;
  orientation?: string | null;
  notes?: string | null;
}

/**
 * The NOA / FL number picked for a mullion. The floor plan editor saves it as `noaNumber` and leaves
 * `flNumber` empty, while older plans only have `flNumber`, so read both.
 */
export function mullionNoaNumber(m: FloorPlanMullion): string {
  return String(m.noaNumber || m.flNumber || "").trim();
}

export interface RoofingComponent {
  id: string;
  component_type: string;
  manufacturer?: string | null;
  product?: string | null;
  noa_number_hint?: string | null;
}

export interface NoaLibraryRow {
  id: string;
  manufacturer: string;
  series: string | null;
  noa_number: string;
  trade: string;
  file_name: string | null;
  storage_path: string | null;
  effective_date: string | null;
  expiration_date: string | null;
  notes: string | null;
  // Optional metadata used by the permit-package builder and Permit Checklist
  // PDF. Populated when the row was seeded from richer sources; may be
  // missing on older rows.
  model_number?: string | null;
  pressure_pos?: number | null;
  pressure_neg?: number | null;
  window_type?: string | null;
}

export interface ScheduleGroup {
  key: string;
  manufacturer: string;
  series: string;
  /** Openings on the schedule using this manufacturer/series combo. */
  openings: { id: string | number; location: string; scheduleNoa: string }[];
  /** NOA library entries whose manufacturer + series match this combo, newest effective date first. */
  matches: NoaLibraryRow[];
}

export interface MullionGroup {
  id: string | number;
  /** Plan label: M1, M2... in the order the mullions are listed on the job. */
  label?: string;
  orientation?: string;
  notes?: string;
  size: string;
  flNumber: string;
  matches: NoaLibraryRow[];
}

function norm(v: string | null | undefined): string {
  return (v ?? "").trim().toLowerCase();
}

// Generic industry words that don't distinguish one manufacturer from
// another (e.g. floor-plan entries typed as "ES" should still match a NOA
// library row entered as "ES WINDOWS" — same manufacturer, just typed with
// varying amounts of boilerplate in the two tools).
const MANUFACTURER_GENERIC_WORDS = new Set([
  "windows",
  "window",
  "doors",
  "door",
  "inc",
  "llc",
  "corp",
  "corporation",
  "co",
  "company",
  "systems",
  "and",
]);

/**
 * Loose manufacturer-name match: lowercase, trim, strip punctuation, then
 * drop generic industry words ("windows", "inc", "llc", etc.) before
 * comparing. Series/model numbers still use exact `norm()` equality — only
 * the manufacturer side is this forgiving, since that's where floor-plan
 * entries and NOA library entries typed by hand in two different tools
 * tend to drift ("ES" vs "ES WINDOWS").
 */
function normManufacturer(v: string | null | undefined): string {
  const base = norm(v).replace(/[.,&]/g, " ");
  const words = base.split(/\s+/).filter((w) => w && !MANUFACTURER_GENERIC_WORDS.has(w));
  return words.join(" ");
}

export function groupScheduleByProduct(windows: FloorPlanWindow[]): ScheduleGroup[] {
  const groups = new Map<string, ScheduleGroup>();
  for (const w of windows) {
    const manufacturer = (w.manufacturer ?? "").trim();
    const series = (w.series ?? "").trim();
    if (!manufacturer && !series) continue;
    const key = `${norm(manufacturer)}|||${norm(series)}`;
    if (!groups.has(key)) {
      groups.set(key, { key, manufacturer, series, openings: [], matches: [] });
    }
    groups.get(key)!.openings.push({
      id: w.id,
      location: (w.location ?? "").trim() || `Opening ${w.id}`,
      scheduleNoa: (w.productApproval ?? "").trim(),
    });
  }
  return Array.from(groups.values()).sort((a, b) =>
    a.manufacturer.localeCompare(b.manufacturer) || a.series.localeCompare(b.series),
  );
}

// Normalize an NOA / product-approval number so "24-0430.06", "24 0430.06",
// and "NOA 24-0430.06" all compare equal. Strips whitespace and any leading
// "noa"/"fl" label; hyphens and dots are preserved because they're part of
// the canonical Miami-Dade / Florida approval format.
function normNoaNumber(v: string | null | undefined): string {
  return norm(v).replace(/^(noa|fl)\s*/i, "").replace(/\s+/g, "");
}

export function matchNoaLibrary(groups: ScheduleGroup[], library: NoaLibraryRow[]): ScheduleGroup[] {
  return groups.map((g) => {
    // AUTHORITATIVE path: the per-opening approval number the user picked
    // on the floor plan (win.productApproval). The floor-plan tool renders
    // a series's NOA row and its FL row as two separate dropdown options,
    // so this value tells us EXACTLY which library row the user chose —
    // NOA vs FL for the same series. Only that library row's PDF should
    // ship in the permit package.
    const scheduleApprovals = new Set(
      g.openings.map((o) => normNoaNumber(o.scheduleNoa)).filter((s) => s.length > 0),
    );
    if (scheduleApprovals.size > 0) {
      const byApproval = library
        .filter((row) => scheduleApprovals.has(normNoaNumber(row.noa_number)))
        .sort((a, b) => (b.effective_date ?? "").localeCompare(a.effective_date ?? ""));
      if (byApproval.length > 0) return { ...g, matches: byApproval };
    }
    // Fallback path (no approval number typed on any opening in this
    // group): manufacturer + series equality. Used for legacy rows or
    // when the user hasn't picked from the dropdown yet. In this case we
    // may return both an NOA and an FL library row for the same series —
    // that's intentional so the reviewer at least sees the options.
    const matches = library
      .filter(
        (row) =>
          normManufacturer(row.manufacturer) === normManufacturer(g.manufacturer) &&
          norm(row.series) === norm(g.series),
      )
      .sort((a, b) => (b.effective_date ?? "").localeCompare(a.effective_date ?? ""));
    return { ...g, matches };
  });
}

export function matchMullions(mullions: FloorPlanMullion[], library: NoaLibraryRow[]): MullionGroup[] {
  return mullions
    .map((m, i) => ({ m, label: `M${i + 1}`, flNumber: mullionNoaNumber(m) }))
    .filter((x) => x.flNumber)
    .map(({ m, label, flNumber }) => {
      const target = normNoaNumber(flNumber);
      const matches = library
        .filter((row) => normNoaNumber(row.noa_number) === target)
        .sort((a, b) => (b.effective_date ?? "").localeCompare(a.effective_date ?? ""));
      return {
        id: m.id,
        label,
        orientation: (m.orientation ?? "").trim() || "auto",
        notes: (m.notes ?? "").trim(),
        size: (m.size ?? "").trim() || "—",
        flNumber,
        matches,
      };
    });
}

/**
 * Checklist warnings for mullions: marks (M1, M2...) with no NOA selected, and marks whose NOA in the
 * library has expired.
 */
export function mullionNoaIssues(
  mullions: FloorPlanMullion[],
  library: NoaLibraryRow[],
): { missing: string[]; expired: string[] } {
  const missing: string[] = [];
  const expired: string[] = [];
  mullions.forEach((m, i) => {
    const label = `M${i + 1}`;
    const noa = mullionNoaNumber(m);
    if (!noa) {
      missing.push(label);
      return;
    }
    const target = normNoaNumber(noa);
    const best = library
      .filter((row) => normNoaNumber(row.noa_number) === target)
      .sort((a, b) => (b.effective_date ?? "").localeCompare(a.effective_date ?? ""))[0];
    if (best && noaExpiryStatus(best) === "expired") expired.push(label);
  });
  return { missing, expired };
}

export type NoaExpiryStatus = "expired" | "expiring" | "active" | "unknown";

export function noaExpiryStatus(row: NoaLibraryRow, asOf: Date = new Date()): NoaExpiryStatus {
  if (!row.expiration_date) return "unknown";
  const exp = new Date(row.expiration_date);
  const daysLeft = (exp.getTime() - asOf.getTime()) / (1000 * 60 * 60 * 24);
  if (daysLeft < 0) return "expired";
  if (daysLeft <= 60) return "expiring";
  return "active";
}

/**
 * Whether an NOA library row's `trade` value applies to a given job. Uses
 * the normalized trade family (windows/roofing/general) so a row tagged
 * "roofing" surfaces for any covering type (tile/shingle/metal/roofing/
 * historical "Roof"), while a row tagged with a specific covering ("tile",
 * "shingle", "metal") only surfaces for jobs with that exact covering.
 */
export function tradeMatchesJob(rowTrade: string, jobTrade: string | null | undefined): boolean {
  const row = (rowTrade ?? "").trim().toLowerCase();
  if (row === "general" || !row) return true;

  const jobFamily = normalizeTradeFamily(jobTrade);
  if (jobFamily === "general") return true;

  if (row === "windows" || row === "roofing") return row === jobFamily;

  // Row names a specific roof covering (tile/shingle/metal) — only match
  // jobs with that exact covering, falling back to a plain string compare
  // for any other historical value that isn't a recognized covering.
  const jobCovering = roofCoveringFromTrade(jobTrade);
  if (jobCovering) return row === jobCovering;
  return row === (jobTrade ?? "").trim().toLowerCase();
}

export interface RoofingComponentMatch {
  id: string;
  componentType: string;
  manufacturer: string;
  product: string;
  noaNumberHint: string;
  matches: NoaLibraryRow[];
}

/**
 * Matches a job's roofing components (tile/underlayment/foam, shingle, or
 * metal panel — entered on the Roofing Details tab) against the org's NOA
 * library, the same manufacturer + series equality used for window/door
 * schedules. Each component is matched independently since, unlike a
 * window schedule, there's no repeated "openings" to group by.
 */
export function matchRoofingComponents(
  components: RoofingComponent[],
  library: NoaLibraryRow[],
): RoofingComponentMatch[] {
  return components
    .filter((c) => (c.manufacturer ?? "").trim() || (c.product ?? "").trim())
    .map((c) => {
      const manufacturer = (c.manufacturer ?? "").trim();
      const product = (c.product ?? "").trim();
      const matches = library
        .filter(
          (row) =>
            normManufacturer(row.manufacturer) === normManufacturer(manufacturer) &&
            norm(row.series) === norm(product),
        )
        .sort((a, b) => (b.effective_date ?? "").localeCompare(a.effective_date ?? ""));
      return {
        id: String(c.id),
        componentType: c.component_type,
        manufacturer,
        product,
        noaNumberHint: (c.noa_number_hint ?? "").trim(),
        matches,
      };
    });
}
