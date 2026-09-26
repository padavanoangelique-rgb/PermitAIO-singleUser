"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

/** Mirrors Dynamics365SyncButton's fetch/show-status pattern — calls the
 * exact same sync engine the 3x/day cron uses. */
export function SyncNowButton({ connectionId }: { connectionId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  async function sync() {
    setLoading(true);
    setMessage(null);
    setIsError(false);
    try {
      const res = await fetch("/api/admin/sheets/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ connectionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sync failed.");
      setMessage(
        `Read ${data.rowsRead}, matched ${data.rowsMatched}, updated ${data.rowsUpdated}, skipped ${data.rowsSkipped}${data.rowsErrored ? `, errored ${data.rowsErrored}` : ""}.`,
      );
      router.refresh();
    } catch (err) {
      setIsError(true);
      setMessage(err instanceof Error ? err.message : "Sync failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button type="button" variant="outline" size="sm" onClick={sync} disabled={loading}>
        {loading ? "Syncing…" : "Sync now"}
      </Button>
      {message && (
        <span className={`text-xs ${isError ? "text-destructive" : "text-muted-foreground"}`}>{message}</span>
      )}
    </div>
  );
}
