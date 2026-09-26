"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { HOA_CITIES_BY_COUNTY, HOA_COUNTIES, type HoaCounty } from "@/lib/hoa/spine-cities";
import { HOA_SPINE_SQL, type HoaSpineCard } from "@/lib/hoa/spine";
import { addDirectoryHoaToTracker } from "@/app/(app)/hoa/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function HoaDirectory({
  selectedSpineId,
  onOpened,
  onTotal,
}: {
  selectedSpineId?: string | null;
  onOpened?: (hoa: { id: string; name: string; spineId: string }) => void;
  onTotal?: (total: number) => void;
}) {
  const [county, setCounty] = useState<HoaCounty | "">("Broward");
  const [city, setCity] = useState("");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<HoaSpineCard[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [note, setNote] = useState("");
  const [needSql, setNeedSql] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const imported = useRef(false);

  const cities = useMemo(() => (county ? HOA_CITIES_BY_COUNTY[county] : []), [county]);

  useEffect(() => {
    const handle = setTimeout(() => {
      void load({ allowImport: true });
    }, 200);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [county, city, q]);

  async function load(opts?: { allowImport?: boolean }) {
    setLoading(true);
    const params = new URLSearchParams();
    if (county) params.set("county", county);
    if (city) params.set("city", city);
    if (q.trim()) params.set("q", q.trim());
    const res = await fetch(`/api/hoa/directory?${params.toString()}`);
    const json = (await res.json()) as { rows?: HoaSpineCard[]; total?: number; note?: string; error?: string };
    const error = json.error || "";
    const empty = !json.rows?.length;
    const missing = /hoa_spine|schema cache|does not exist/i.test(error);

    if (missing) {
      setNeedSql(true);
      setRows([]);
      setNote("The HOA table is not in the database yet. Run the SQL below once, then click Load HOAs.");
      setLoading(false);
      return;
    }

    if (empty && !q.trim() && opts?.allowImport && !imported.current) {
      imported.current = true;
      setLoading(false);
      await runImport();
      await load({ allowImport: false });
      return;
    }

    setNeedSql(false);
    setRows(json.rows ?? []);
    setTotal(json.total ?? 0);
    if (typeof json.total === "number") onTotal?.(json.total);
    setNote(error || json.note || "");
    setLoading(false);
  }

  async function runImport() {
    setImporting(true);
    setNote("Loading 5,346 South Florida associations…");
    const res = await fetch("/api/admin/hoa-spine/import", { method: "POST" });
    const json = (await res.json()) as { ok?: boolean; upserted?: number; total?: number; error?: string; needSql?: boolean };
    setImporting(false);
    if (!res.ok) {
      setNeedSql(!!json.needSql);
      setNote(json.error || "Couldn't load HOAs.");
      return;
    }
    setNeedSql(false);
    setNote(`${json.upserted ?? json.total} associations ready.`);
    const stats = await fetch("/api/hoa/directory?stats=1");
    const body = (await stats.json()) as { total?: number };
    if (typeof body.total === "number") onTotal?.(body.total);
  }

  async function openRow(id: string) {
    setBusyId(id);
    const result = await addDirectoryHoaToTracker(id);
    setBusyId(null);
    if ("error" in result) {
      alert(result.error);
      return;
    }
    onOpened?.({ ...result, spineId: id });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {HOA_COUNTIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => {
              setCounty(c);
              setCity("");
            }}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
              county === c ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground"
            }`}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <select
          className="h-10 min-w-[200px] rounded-md border bg-background px-3 text-sm"
          value={city}
          onChange={(e) => setCity(e.target.value)}
        >
          <option value="">All cities</option>
          {cities.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search association or management company…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        {needSql || rows.length === 0 ? (
          <Button
            variant="outline"
            disabled={importing}
            onClick={() => {
              imported.current = false;
              void runImport().then(() => load({ allowImport: false }));
            }}
          >
            {importing ? "Loading…" : "Load HOAs"}
          </Button>
        ) : null}
      </div>
      <p className="text-sm text-muted-foreground">
        {importing
          ? "Loading 5,346 associations…"
          : loading
            ? "Searching…"
            : note || `${total.toLocaleString()} in ${county || "South Florida"} · ${rows.length} shown`}
      </p>
      {needSql ? (
        <div className="space-y-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <p className="font-medium">Run this once in Supabase → SQL, then click Load HOAs.</p>
          <textarea
            readOnly
            className="h-40 w-full rounded-md border bg-background p-2 font-mono text-xs"
            value={HOA_SPINE_SQL}
          />
        </div>
      ) : null}
      <div className="overflow-x-auto rounded-xl border">
        <Table className="text-sm">
          <TableHeader>
            <TableRow>
              <TableHead>Association</TableHead>
              <TableHead>City</TableHead>
              <TableHead>Management</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Email</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.id}
                className={`cursor-pointer ${selectedSpineId === row.id || busyId === row.id ? "bg-primary/5" : ""}`}
                onClick={() => void openRow(row.id)}
              >
                <TableCell className="font-medium">{row.name}</TableCell>
                <TableCell>{row.city || "—"}</TableCell>
                <TableCell className="max-w-[180px] truncate">{row.mgmt_co || "—"}</TableCell>
                <TableCell className="whitespace-nowrap">{row.phone || "—"}</TableCell>
                <TableCell className="max-w-[180px] truncate">{row.email || "—"}</TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    className="h-8 rounded-full"
                    disabled={busyId === row.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      void openRow(row.id);
                    }}
                  >
                    {busyId === row.id ? "Opening…" : "Open"}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!loading && !importing && rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  {needSql ? "HOA table is missing." : "No matches. Try another city or a shorter name."}
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
