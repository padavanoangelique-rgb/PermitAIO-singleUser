"use client";

import { useState } from "react";
import Link from "next/link";
import { BTN_BLUE, BTN_PURPLE } from "@/lib/ui/chrome";

export function FloorPlanShare({ jobId }: { jobId: string }) {
  const [copied, setCopied] = useState(false);
  const path = `/jobs/${jobId}/floor-plan`;

  async function copy() {
    const url = `${window.location.origin}${path}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section className="space-y-3 px-1 py-2">
      <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Floor plan</h2>
      <p className="text-sm text-muted-foreground">
        Same drawing for permit, warehouse, sales, and install. Copy the link and send it inside the company.
      </p>
      <div className="flex flex-wrap gap-2">
        <Link href={path} className={BTN_BLUE}>
          Open floor plan
        </Link>
        <button type="button" onClick={() => void copy()} className={BTN_PURPLE}>
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>
    </section>
  );
}
