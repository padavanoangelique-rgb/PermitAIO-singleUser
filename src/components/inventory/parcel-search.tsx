"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ParcelCountyKey, ParcelHit } from "@/lib/parcel/lookup";

const COUNTY_TO_KEY: Record<string, ParcelCountyKey> = {
  "Miami-Dade County": "miami-dade",
  "Broward County": "broward",
  "Palm Beach County": "palm-beach",
};

export function ParcelSearch({
  countyLabel,
  onPick,
}: {
  countyLabel: string;
  onPick: (hit: ParcelHit) => void;
}) {
  const key = COUNTY_TO_KEY[countyLabel];
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<ParcelHit[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!key || q.trim().length < 4) {
      setHits([]);
      return;
    }
    const handle = setTimeout(async () => {
      setBusy(true);
      setErr(null);
      try {
        const res = await fetch(`/api/parcel-lookup?county=${key}&q=${encodeURIComponent(q.trim())}`);
        const data = await res.json();
        if (!res.ok) setErr(data.error ?? "Lookup failed");
        setHits(data.results ?? []);
      } catch {
        setErr("Lookup failed");
      } finally {
        setBusy(false);
      }
    }, 350);
    return () => clearTimeout(handle);
  }, [key, q]);

  if (!key) {
    return (
      <p className="text-xs text-muted-foreground">
        Parcel lookup is live for Miami-Dade, Broward, and Palm Beach. Pick one of those counties first.
      </p>
    );
  }

  return (
    <div className="space-y-2 md:col-span-3">
      <Label>Property lookup</Label>
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Type folio, owner name, or street — results fill address + folio + city"
      />
      {busy && <p className="text-xs text-muted-foreground">Searching county records…</p>}
      {err && <p className="text-xs text-destructive">{err}</p>}
      {hits.length > 0 && (
        <ul className="max-h-48 overflow-y-auto rounded-md border bg-background text-sm">
          {hits.map((hit, i) => (
            <li key={`${hit.folio}-${i}`}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left hover:bg-muted"
                onClick={() => {
                  onPick(hit);
                  setQ(hit.address || hit.folio);
                  setHits([]);
                }}
              >
                <span className="font-medium">{hit.address || "(no site address)"}</span>
                <span className="block text-xs text-muted-foreground">
                  {hit.owner} · folio {hit.folio}
                  {hit.city ? ` · ${hit.city}` : ""}
                  {hit.millageCode ? ` · millage ${hit.millageCode}` : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
