"use client";

import { useState } from "react";
import { MapPin } from "lucide-react";
import type { Tables } from "@/lib/supabase/types";
import type { ParcelHit } from "@/lib/parcel/lookup";
import { COUNTIES, canonicalJurisdiction, countyOf, jurisdictionsInCounty } from "@/lib/inventory/constants";
import { updateJobFolioJurisdiction } from "@/lib/actions/forms";
import { ParcelSearch } from "@/components/inventory/parcel-search";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Job = Tables<"jobs">;

const PILL =
    "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-primary px-3.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90";

// Moved from the Permit Inventory row — same field mapping (address, folio, jurisdiction, city, Broward code) via updateJobFolioJurisdiction.
export function ParcelLookupCard({ job, onApplied }: { job: Job; onApplied?: () => void }) {
    const [showSearch, setShowSearch] = useState(false);
    const [county, setCounty] = useState(() => countyOf(job.jurisdiction));
    const [applying, setApplying] = useState(false);
    const [error, setError] = useState<string | null>(null);

  async function applyParcel(hit: ParcelHit) {
        const cities = jurisdictionsInCounty(hit.countyLabel);
        const rawCity = (hit.city || "").trim();
        const cityMatch =
                !rawCity || /unincorporated/i.test(rawCity)
            ? hit.countyLabel
                  : (cities.find((j) => j.toLowerCase() === rawCity.toLowerCase()) ??
                               cities.find((j) => j.toLowerCase().includes(rawCity.toLowerCase())) ??
                               "");
        const jurisdiction = cityMatch ? canonicalJurisdiction(cityMatch) : job.jurisdiction ?? "";
        setCounty(hit.countyLabel);
        setApplying(true);
        setError(null);
        const res = await updateJobFolioJurisdiction(
                job.id,
                hit.folio || job.folio_number || "",
                jurisdiction,
                hit.millageCode ?? undefined,
                jurisdiction || job.city || undefined,
                hit.address || job.address || undefined,
              );
        setApplying(false);
        if (res.error) {
                setError(res.error);
                return;
        }
        setShowSearch(false);
        onApplied?.();
  }

  return (
        <Card className="gap-2 py-4">
              <CardHeader className="px-5 py-0">
                      <CardTitle className="flex items-center gap-2 text-base font-heading">
                                <MapPin className="h-4 w-4 text-muted-foreground" />
                                Property location
                      </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 px-5">
                      <div className="grid gap-3 sm:grid-cols-2">
                                <div>
                                            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Address</p>
                                            <p className="text-sm font-semibold">{job.address || "—"}</p>
                                </div>
                                <div>
                                            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Jurisdiction</p>
                                            <p className="text-sm font-semibold">{job.jurisdiction || "—"}</p>
                                </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                                <Select value={county || undefined} onValueChange={setCounty}>
                                            <SelectTrigger className="h-9 w-auto min-w-0 gap-1.5 rounded-full text-sm" size="sm">
                                                          <SelectValue placeholder="County" />
                                            </SelectTrigger>
                                            <SelectContent position="popper">
                                              {COUNTIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                                            </SelectContent>
                                </Select>
                                <button type="button" onClick={() => setShowSearch((v) => !v)} className={PILL}>
                                            <MapPin className="h-3.5 w-3.5" />
                                            Look up parcel
                                </button>
                      </div>
                {error && <p className="text-xs text-destructive">Couldn&rsquo;t save that: {error}</p>}
                {applying && <p className="text-xs text-muted-foreground">Applying…</p>}
                {showSearch && <ParcelSearch countyLabel={county} onPick={(hit) => void applyParcel(hit)} />}
              </CardContent>
        </Card>
      );
}
