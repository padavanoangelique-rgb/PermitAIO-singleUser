"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Download } from "lucide-react";
import { FILL_BLUE, FILL_GREEN, FILL_PURPLE } from "@/lib/ui/fills";
import { FORM_COUNTIES, type FormCounty } from "@/lib/forms/folio";
import { ALL_JURISDICTIONS } from "@/lib/forms/jurisdictions";
import { DOC_TYPE_LABELS } from "@/lib/forms/match";
import {
  buildCityChecklist,
  buildCountyChecklist,
  groupChecklist,
  isContactRow,
  type RequirementsRow,
} from "@/lib/forms/borrow-rules";
import { linkify } from "@/lib/forms/contact-notes";
import { CountyFold, LIB_PILL, LIB_ROW, LibrarySearch } from "./county-fold";
import { BuildingDeptCard } from "./building-dept-card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Tables } from "@/lib/supabase/types";

type FormTemplate = Tables<"form_templates">;

export function FormsCountyBoard({
  rows,
  templates,
  isAdmin,
}: {
  rows: RequirementsRow[];
  templates: FormTemplate[];
  isAdmin: boolean;
}) {
  const [query, setQuery] = useState("");
  const [openCounties, setOpenCounties] = useState<Set<string>>(new Set());
  const [openCity, setOpenCity] = useState<string | null>(null);
  const q = query.trim().toLowerCase();

  const counties = useMemo(() => {
    return FORM_COUNTIES.map((county) => {
      const cities = cityList(county, rows, templates);
      const visible = q
        ? cities.filter((city) => cityMatches(county, city, q, rows, templates))
        : cities;
      return { county, cities: visible, total: cities.length };
    }).filter((c) => c.cities.length > 0 || !q);
  }, [rows, templates, q]);

  function toggleCounty(county: string) {
    setOpenCounties((prev) => {
      const next = new Set(prev);
      if (next.has(county)) next.delete(county);
      else next.add(county);
      return next;
    });
  }

  const expanded = q ? new Set(counties.map((c) => c.county)) : openCounties;
  const openParts = openCity?.split("::") ?? [];
  const openCounty = (openParts[0] as FormCounty | undefined) ?? null;
  const openCityName = openParts[1] ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <LibrarySearch value={query} onChange={setQuery} placeholder="Search county, city, or form" />
        {isAdmin ? (
          <div className="flex flex-wrap gap-1.5">
            <Link href="/admin/forms" className={`${LIB_PILL} ${FILL_BLUE}`}>
              Edit fillable forms
            </Link>
            <Link href="/admin/requirements" className={`${LIB_PILL} ${FILL_PURPLE}`}>
              Edit requirements
            </Link>
          </div>
        ) : null}
      </div>

      {counties.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">No forms match that search.</p>
      ) : (
        <div className="space-y-1">
          {counties.map(({ county, cities, total }) => (
            <CountyFold
              key={county}
              title={county}
              countLabel={`${cities.length}${q ? ` of ${total}` : ""} ${cities.length === 1 ? "city" : "cities"}`}
              open={expanded.has(county)}
              onToggle={() => toggleCounty(county)}
            >
              {cities.map((city) => {
                const key = `${county}::${city}`;
                const reqs = city === COUNTY_WIDE
                  ? rows.filter((r) => r.county === county && isCountyWideName(r.jurisdiction, county))
                  : rows.filter((r) => r.county === county && r.jurisdiction.toLowerCase() === city.toLowerCase());
                const pdfs = templatesFor(templates, county, city);
                const count = reqs.length + pdfs.length;
                return (
                  <article key={key}>
                    <button
                      type="button"
                      onClick={() => setOpenCity(key)}
                      className={LIB_ROW}
                    >
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      <span className={`${LIB_PILL} ${FILL_BLUE}`}>{city === COUNTY_WIDE ? "County-wide" : city}</span>
                      <span className="text-sm text-muted-foreground">
                        {count ? `${count} on file` : "None"}
                      </span>
                    </button>
                  </article>
                );
              })}
            </CountyFold>
          ))}
        </div>
      )}

      <Dialog open={Boolean(openCity)} onOpenChange={(open) => { if (!open) setOpenCity(null); }}>
        <DialogContent className="flex max-h-[90vh] w-[calc(100%-1.5rem)] max-w-4xl flex-col overflow-hidden sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="font-heading text-2xl">
              {openCityName === COUNTY_WIDE
                ? `${openCounty} County — county-wide`
                : openCityName}
            </DialogTitle>
            {openCounty && openCityName !== COUNTY_WIDE ? (
              <p className="text-sm text-muted-foreground">{openCounty} County</p>
            ) : null}
          </DialogHeader>
          {openCounty && openCityName ? (
            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              <CityDetail county={openCounty} city={openCityName} rows={rows} templates={templates} />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

const COUNTY_WIDE = "__COUNTY_WIDE__";

function cityList(county: FormCounty, rows: RequirementsRow[], templates: FormTemplate[]) {
  const set = new Set<string>([COUNTY_WIDE, ...(ALL_JURISDICTIONS[county] ?? [])]);
  for (const row of rows) {
    if (row.county !== county) continue;
    if (isCountyWideName(row.jurisdiction, county)) continue;
    if (row.jurisdiction) set.add(row.jurisdiction);
  }
  for (const t of templates) {
    if (t.county !== county || !t.jurisdiction_name) continue;
    set.add(t.jurisdiction_name);
  }
  const [, ...rest] = [COUNTY_WIDE, ...Array.from(set).filter((c) => c !== COUNTY_WIDE).sort((a, b) => a.localeCompare(b))];
  return [COUNTY_WIDE, ...rest];
}

function isCountyWideName(name: string, county: FormCounty) {
  const n = name.trim().toLowerCase();
  return n === `${county.toLowerCase()} county` || n === county.toLowerCase();
}

function templatesFor(templates: FormTemplate[], county: FormCounty, city: string) {
  return templates.filter((t) => {
    if (t.county !== county) return false;
    const cityName = t.jurisdiction_name?.trim() || "";
    if (city === COUNTY_WIDE) return !cityName;
    return cityName.toLowerCase() === city.toLowerCase();
  });
}

function cityMatches(
  county: FormCounty,
  city: string,
  q: string,
  rows: RequirementsRow[],
  templates: FormTemplate[],
) {
  const label = city === COUNTY_WIDE ? `${county} county-wide` : city;
  if (county.toLowerCase().includes(q) || label.toLowerCase().includes(q)) return true;
  const reqs = city === COUNTY_WIDE
    ? rows.filter((r) => r.county === county && isCountyWideName(r.jurisdiction, county))
    : rows.filter((r) => r.county === county && r.jurisdiction.toLowerCase() === city.toLowerCase());
  const pdfs = templatesFor(templates, county, city);
  return reqs.some((r) => `${r.title} ${r.notes ?? ""}`.toLowerCase().includes(q))
    || pdfs.some((t) => t.title.toLowerCase().includes(q));
}

function CityDetail({
  county,
  city,
  rows,
  templates,
}: {
  county: FormCounty;
  city: string;
  rows: RequirementsRow[];
  templates: FormTemplate[];
}) {
  const checklist = city === COUNTY_WIDE
    ? buildCountyChecklist(rows, county)
    : buildCityChecklist(rows, county, city);
  const grouped = groupChecklist(checklist);
  const pdfs = templatesFor(templates, county, city);
  const label = city === COUNTY_WIDE ? `${county} County` : city;

  if (grouped.length === 0 && pdfs.length === 0) {
    return <p className="py-6 text-sm text-muted-foreground">Nothing on file for this city yet.</p>;
  }

  return (
    <div className="space-y-5 pb-2">
      {grouped.map((g, gi) => {
        if (g.kind === "contact") {
          return <BuildingDeptCard key={`contact-${g.row.id}`} notes={g.row.notes} city={label} />;
        }
        return (
          <div key={`g-${gi}-${g.docType}`} className="space-y-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {DOC_TYPE_LABELS[g.docType] ?? g.docType}
            </p>
            {g.rows.map((row) => (
              <div key={row.id} className="flex flex-wrap items-center gap-2 rounded-2xl bg-muted/30 px-3 py-3">
                <span className={`${LIB_PILL} ${FILL_PURPLE}`}>{row.title}</span>
                {row.borrowedFrom ? <span className="text-xs text-muted-foreground">County-wide</span> : null}
                {row.file_name && row.file_data ? (
                  <a href={row.file_data} download={row.file_name} className={`${LIB_PILL} ${FILL_BLUE}`}>
                    <Download className="h-3.5 w-3.5" />
                    {row.file_name}
                  </a>
                ) : null}
                {row.notes && !isContactRow(row) ? (
                  <p className="w-full whitespace-pre-wrap px-1 text-sm leading-relaxed text-muted-foreground">
                    {linkify(row.notes)}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        );
      })}
      {pdfs.length ? (
        <div className="space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Fillable PDFs</p>
          {pdfs.map((t) => {
            const mapped = t.field_mapping ? Object.keys(t.field_mapping as object).length : 0;
            return (
              <div key={t.id} className="flex flex-wrap items-center gap-2 rounded-2xl bg-muted/30 px-3 py-3">
                <span className={`${LIB_PILL} ${FILL_GREEN}`}>{t.title}</span>
                <span className="text-sm text-muted-foreground">
                  {DOC_TYPE_LABELS[t.doc_type] ?? t.doc_type}
                  {" · "}
                  {!t.file_name ? "no PDF" : mapped === 0 ? "PDF ready" : `${mapped} fields mapped`}
                </span>
                {t.file_name && t.file_data ? (
                  <a href={t.file_data} download={t.file_name} className={`${LIB_PILL} ${FILL_BLUE}`}>
                    <Download className="h-3.5 w-3.5" />
                    {t.file_name}
                  </a>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
