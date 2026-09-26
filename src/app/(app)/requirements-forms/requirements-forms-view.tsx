"use client";

import { useMemo, useState } from "react";
import {
  FileText,
  Download,
  Building2,
  MapPin,
  Phone,
  Link2,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { FormCounty } from "@/lib/forms/folio";
import { DOC_TYPE_LABELS } from "@/lib/forms/match";
import { ALL_JURISDICTIONS } from "@/lib/forms/jurisdictions";
import {
  buildCityChecklist,
  buildCountyChecklist,
  groupChecklist,
  isContactRow,
  type RequirementsRow,
} from "@/lib/forms/borrow-rules";
import { linkify, parseContactNotes } from "@/lib/forms/contact-notes";

export type RequirementsFormsRow = RequirementsRow;

/**
 * The Requirements & Forms view has TWO modes:
 *
 *  1. Locked-jurisdiction mode (`lockJurisdiction=true`): the caller pins the
 *     view to a specific (county, city). Used by the job Requirements & Forms
 *     tab so the panel is scoped to the job's own jurisdiction. Renders the
 *     borrowed-into-city checklist grouped by doc type.
 *
 *  2. Browse mode (the sidebar `/requirements-forms` page): mirror the HTML
 *     floor-plan tool's R&F split-pane layout — a search box + nested
 *     collapsible city list on the left across all three counties, and a
 *     detail pane on the right that shows the selected city's checklist
 *     (same grouped-card render as locked-jurisdiction mode).
 */
export function RequirementsFormsView({
  counties,
  rows,
  initialCounty,
  initialJurisdiction,
  compact = false,
  lockJurisdiction = false,
}: {
  counties: readonly FormCounty[];
  rows: RequirementsFormsRow[];
  initialCounty?: FormCounty | null;
  initialJurisdiction?: string | null;
  compact?: boolean;
  lockJurisdiction?: boolean;
}) {
  // --- Locked-jurisdiction mode (job Requirements & Forms tab) ---
  // Renders exactly like before: pinned checklist for the job's jurisdiction.
  if (lockJurisdiction) {
    return (
      <LockedChecklist
        rows={rows}
        county={initialCounty ?? null}
        jurisdiction={initialJurisdiction ?? null}
        compact={compact}
      />
    );
  }

  // --- Browse mode (sidebar page): nested split-pane across all counties ---
  return <BrowseSplitPane counties={counties} rows={rows} />;
}

/* -------------------------------------------------------------------------- */
/*  Locked-jurisdiction rendering (unchanged behaviour)                       */
/* -------------------------------------------------------------------------- */

function LockedChecklist({
  rows,
  county,
  jurisdiction,
  compact,
}: {
  rows: RequirementsFormsRow[];
  county: FormCounty | null;
  jurisdiction: string | null;
  compact: boolean;
}) {
  const checklist = useMemo(() => {
    if (!county) return [];
    if (jurisdiction && jurisdiction !== "__COUNTY_WIDE__") {
      return buildCityChecklist(rows, county, jurisdiction);
    }
    return buildCountyChecklist(rows, county);
  }, [rows, county, jurisdiction]);
  const grouped = useMemo(() => groupChecklist(checklist), [checklist]);

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      {!county && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No jurisdiction set on the Permit Inventory tab yet.
          </CardContent>
        </Card>
      )}
      {county && grouped.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No requirements are on file yet for this selection. The platform
            team is still populating this library — check back soon.
          </CardContent>
        </Card>
      )}
      <ChecklistCards grouped={grouped} />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Browse mode — nested split-pane across every county                       */
/* -------------------------------------------------------------------------- */

type CityNode = {
  county: FormCounty;
  jurisdiction: string;
  key: string; // stable id used for selection
  isCountyWide: boolean;
  entryCount: number;
  matches: boolean; // matches the current search
};

function BrowseSplitPane({
  counties,
  rows,
}: {
  counties: readonly FormCounty[];
  rows: RequirementsFormsRow[];
}) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Build the nested list: one section per county with:
  //   - a "County-wide" pseudo-city at the top
  //   - every city from ALL_JURISDICTIONS
  //
  // entryCount is the number of platform rows that specifically belong to
  // that city (not including the borrowed county-wide rows) — a quick
  // signal so the user can see which cities have their own paperwork.
  const nodes: CityNode[] = useMemo(() => {
    const search_q = search.trim().toLowerCase();
    const out: CityNode[] = [];
    for (const county of counties) {
      const countyLabel = `${county} County`;
      // County-wide pseudo-city.
      const countyWideRows = rows.filter(
        (r) => r.county === county && r.jurisdiction === countyLabel,
      );
      out.push({
        county,
        jurisdiction: countyLabel,
        key: `${county}::__COUNTY_WIDE__`,
        isCountyWide: true,
        entryCount: countyWideRows.length,
        matches: matchesSearch(countyLabel, countyWideRows, search_q),
      });
      for (const city of ALL_JURISDICTIONS[county]) {
        const cityRows = rows.filter(
          (r) =>
            r.county === county &&
            r.jurisdiction.toLowerCase() === city.toLowerCase(),
        );
        out.push({
          county,
          jurisdiction: city,
          key: `${county}::${city}`,
          isCountyWide: false,
          entryCount: cityRows.length,
          matches: matchesSearch(city, cityRows, search_q),
        });
      }
    }
    return out;
  }, [counties, rows, search]);

  // Group nodes by county for section headers.
  const byCounty = useMemo(() => {
    const map = new Map<FormCounty, CityNode[]>();
    for (const n of nodes) {
      if (!n.matches) continue;
      const bucket = map.get(n.county) ?? [];
      bucket.push(n);
      map.set(n.county, bucket);
    }
    return map;
  }, [nodes]);

  const selectedNode = useMemo(
    () => nodes.find((n) => n.key === selectedKey) ?? null,
    [nodes, selectedKey],
  );

  const checklist = useMemo(() => {
    if (!selectedNode) return [];
    if (selectedNode.isCountyWide) {
      return buildCountyChecklist(rows, selectedNode.county);
    }
    return buildCityChecklist(rows, selectedNode.county, selectedNode.jurisdiction);
  }, [rows, selectedNode]);

  const grouped = useMemo(() => groupChecklist(checklist), [checklist]);

  function toggleCounty(county: FormCounty) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(county)) next.delete(county);
      else next.add(county);
      return next;
    });
  }

  // Auto-expand every county section when the user is searching.
  const effectiveExpanded = search.trim()
    ? new Set<string>(counties as readonly string[])
    : expanded;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[340px_1fr]">
      {/* --- Left: search + nested list --- */}
      <div className="flex min-h-[600px] flex-col overflow-hidden rounded-lg border border-border bg-card">
        <div className="border-b border-border p-3">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search jurisdiction, title, notes…"
            className="h-9"
          />
          <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
            Platform library — shared across every account (read-only).
          </p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {counties.map((county) => {
            const bucket = byCounty.get(county) ?? [];
            if (bucket.length === 0) return null;
            const isOpen = effectiveExpanded.has(county);
            return (
              <div key={county} className="border-b border-border/70 last:border-b-0">
                <button
                  type="button"
                  onClick={() => toggleCounty(county)}
                  className="flex w-full items-center gap-2 bg-muted/40 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:bg-muted/60"
                >
                  {isOpen ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                  )}
                  <span>{county}</span>
                  <span className="ml-auto text-[10px] font-normal normal-case tracking-normal text-muted-foreground">
                    {bucket.length} {bucket.length === 1 ? "entry" : "entries"}
                  </span>
                </button>
                {isOpen && (
                  <div>
                    {bucket.map((node) => (
                      <button
                        key={node.key}
                        type="button"
                        onClick={() => setSelectedKey(node.key)}
                        className={[
                          "flex w-full items-center gap-2 border-b border-border/40 px-3 py-2 text-left text-sm hover:bg-muted/50",
                          selectedKey === node.key
                            ? "border-l-2 border-l-primary bg-muted/60"
                            : "border-l-2 border-l-transparent",
                          node.entryCount === 0 && !node.isCountyWide
                            ? "text-muted-foreground"
                            : "",
                        ].join(" ")}
                      >
                        <span className="truncate uppercase tracking-wide">
                          {node.isCountyWide
                            ? `${node.county} — county-wide`
                            : node.jurisdiction}
                        </span>
                        <span className="ml-auto text-xs text-muted-foreground">
                          {node.entryCount}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {byCounty.size === 0 && (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No jurisdictions match &quot;{search}&quot;.
            </div>
          )}
        </div>
      </div>

      {/* --- Right: detail --- */}
      <div className="min-h-[600px] rounded-lg border border-border bg-card p-6 lg:p-8">
        {!selectedNode ? (
          <div className="flex h-full min-h-[400px] items-center justify-center text-sm text-muted-foreground">
            Select an entry on the left.
          </div>
        ) : grouped.length === 0 ? (
          <div className="space-y-4">
            <DetailHeader node={selectedNode} />
            <p className="text-sm text-muted-foreground">
              No requirements are on file yet for this jurisdiction. The
              platform team is still populating this library — check back
              soon.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <DetailHeader node={selectedNode} />
            <ChecklistCards grouped={grouped} />
          </div>
        )}
      </div>
    </div>
  );
}

function DetailHeader({ node }: { node: CityNode }) {
  return (
    <div className="border-b border-border/60 pb-3">
      <div className="text-xs uppercase tracking-[0.15em] text-primary">
        {node.county} County
      </div>
      <h2 className="mt-1 text-2xl font-semibold tracking-tight lg:text-3xl">
        {node.isCountyWide
          ? `${node.county} County — county-wide`
          : node.jurisdiction}
      </h2>
    </div>
  );
}

function matchesSearch(
  jurisdiction: string,
  rows: RequirementsFormsRow[],
  query: string,
): boolean {
  if (!query) return true;
  if (jurisdiction.toLowerCase().includes(query)) return true;
  for (const r of rows) {
    if ((r.title ?? "").toLowerCase().includes(query)) return true;
    if ((r.notes ?? "").toLowerCase().includes(query)) return true;
  }
  return false;
}

/* -------------------------------------------------------------------------- */
/*  Shared card renderer — used by both locked and browse modes               */
/* -------------------------------------------------------------------------- */

function ChecklistCards({
  grouped,
}: {
  grouped: ReturnType<typeof groupChecklist>;
}) {
  return (
    <>
      {grouped.map((g, gi) => {
        if (g.kind === "contact") {
          const row = g.row;
          const parsed = parseContactNotes(row.notes ?? "");
          return (
            <Card key={`contact-${row.id}`}>
              <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-3">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base font-semibold">
                  Building Department
                </CardTitle>
                <Badge variant="secondary" className="ml-auto">
                  {row.jurisdiction}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                {parsed.address.length > 0 && (
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="space-y-0.5">
                      {parsed.address.map((ln, i) => (
                        <div key={i}>{ln}</div>
                      ))}
                    </div>
                  </div>
                )}
                {parsed.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <a
                      href={`tel:${parsed.phone.replace(/[^0-9+]/g, "")}`}
                      className="text-primary underline-offset-2 hover:underline"
                    >
                      {parsed.phone}
                    </a>
                  </div>
                )}
                {parsed.emails.length > 0 && (
                  <div className="space-y-1">
                    {parsed.emails.map((email) => (
                      <div key={email} className="flex items-center gap-2 text-sm">
                        <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <a
                          href={`mailto:${email}`}
                          className="text-primary underline-offset-2 hover:underline"
                        >
                          {email}
                        </a>
                      </div>
                    ))}
                  </div>
                )}
                {parsed.portalUrls.length > 0 && (
                  <div className="space-y-1.5">
                    {parsed.portalUrls.map((p, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs uppercase tracking-wide text-muted-foreground">
                            {p.label}
                          </div>
                          <a
                            href={p.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="break-words text-primary underline underline-offset-2 hover:text-primary/80"
                          >
                            {p.url}
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {parsed.extra && (
                  <div className="whitespace-pre-wrap border-t border-border/60 pt-3 text-sm text-muted-foreground">
                    {linkify(parsed.extra)}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        }

        return (
          <Card key={`g-${gi}-${g.docType}`}>
            <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-3">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base font-semibold">
                {DOC_TYPE_LABELS[g.docType] ?? g.docType}
              </CardTitle>
              <Badge variant="secondary" className="ml-2">
                {g.rows.length}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              {g.rows.map((row) => (
                <div
                  key={row.id}
                  className="rounded-md border border-border/60 bg-muted/20 p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
                        <span>{row.jurisdiction}</span>
                        {row.borrowedFrom && (
                          <Badge
                            variant="outline"
                            className="border-primary/40 px-1.5 py-0 text-[10px] font-medium normal-case tracking-normal text-primary"
                          >
                            County-wide
                          </Badge>
                        )}
                      </div>
                      <div className="font-medium">{row.title}</div>
                    </div>
                    {row.file_name && row.file_data && (
                      <Button
                        size="sm"
                        variant="outline"
                        asChild
                        className="shrink-0"
                      >
                        <a
                          href={row.file_data}
                          download={row.file_name}
                          className="inline-flex items-center gap-1.5"
                        >
                          <Download className="h-3.5 w-3.5" />
                          {row.file_name}
                        </a>
                      </Button>
                    )}
                  </div>
                  {row.notes && !isContactRow(row) && (
                    <div className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                      {linkify(row.notes)}
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}
    </>
  );
}

// Silence unused-Select warning — the picker cards live upstream in
// `<Card>` but the browse view no longer needs them. Keep the imports
// around because callers of this module may still reference the shape.
void Select;
void SelectContent;
void SelectItem;
void SelectTrigger;
void SelectValue;
void Label;
