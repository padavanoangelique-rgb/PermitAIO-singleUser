"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft } from "lucide-react";

/**
 * Renders a small "Back to Job" pill in the app header when the current
 * route is a job sub-tool that hides the normal job tab strip (currently
 * only /jobs/[jobId]/floor-plan, which iframes the vanilla-JS tool and
 * takes over the full page area). This keeps the app chrome unified — no
 * duplicate sub-header inside the tool.
 */
export function HeaderBackToJob() {
  const pathname = usePathname();
  const match = pathname?.match(/^\/jobs\/([^\/]+)\/floor-plan(?:\/|$)/);
  if (!match) return null;
  const jobId = match[1];
  return (
    <Link
      href={`/jobs/${jobId}`}
      className="flex items-center gap-1 rounded-md border bg-background px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <ChevronLeft className="h-3.5 w-3.5" />
      Back to Job
    </Link>
  );
}
