"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminHoaPage() {
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function runImport() {
    setBusy(true);
    setStatus("Loading 5,346 associations into the database…");
    const res = await fetch("/api/admin/hoa-spine/import", { method: "POST" });
    const json = (await res.json()) as { ok?: boolean; total?: number; upserted?: number; error?: string };
    setBusy(false);
    if (!res.ok) {
      setStatus(json.error || "Import failed. Run supabase/39_hoa_spine_county.sql first.");
      return;
    }
    setStatus(`Directory loaded. ${json.upserted ?? json.total} associations in the database.`);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="font-heading">HOA directory</CardTitle>
          <CardDescription>
            Shared South Florida list: Broward, Miami-Dade, Palm Beach. Search by county and city in the HOA tracker. This does not copy 5,000 rows into each contractor.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button disabled={busy} onClick={() => void runImport()}>
            {busy ? "Importing…" : "Load / refresh directory"}
          </Button>
          {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
