"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/**
 * Pushes this job into the org's connected Dynamics 365 environment as an
 * Account + Opportunity. Only rendered when the org has an active
 * connection (checked server-side in the job page) — clicking it hits
 * /api/integrations/dynamics365/sync, which re-checks the connection and
 * the caller's role itself.
 */
export function Dynamics365SyncButton({
  jobId,
  initialSyncStatus,
  initialExternalJobUrl,
}: {
  jobId: string;
  initialSyncStatus: string | null;
  initialExternalJobUrl: string | null;
}) {
  const [status, setStatus] = useState(initialSyncStatus ?? "not_synced");
  const [url, setUrl] = useState(initialExternalJobUrl);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sync() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/integrations/dynamics365/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sync failed.");
      setStatus("synced");
      setUrl(data.externalJobUrl ?? null);
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Sync failed.");
    } finally {
      setLoading(false);
    }
  }

  if (status === "synced" && url) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer">
        <Badge variant="secondary" className="cursor-pointer hover:underline">
          Synced to Dynamics 365 ↗
        </Badge>
      </a>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button type="button" variant="outline" size="sm" onClick={sync} disabled={loading}>
        {loading ? "Syncing…" : status === "error" ? "Retry Dynamics 365 sync" : "Sync to Dynamics 365"}
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
