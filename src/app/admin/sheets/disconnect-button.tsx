"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function DisconnectButton({ connectionId }: { connectionId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function disconnect() {
    if (!confirm("Remove this sheet connection? PermitAIO will stop syncing from it.")) return;
    setLoading(true);
    try {
      await fetch("/api/admin/sheets/disconnect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ connectionId }),
      });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button type="button" variant="ghost" size="sm" onClick={disconnect} disabled={loading}>
      {loading ? "Removing…" : "Disconnect"}
    </Button>
  );
}
