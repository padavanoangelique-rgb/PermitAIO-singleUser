"use client";

import Link from "next/link";
import { Building2, FileStack, MessageSquareWarning, ShieldCheck } from "lucide-react";
import { FILL_AMBER, FILL_BLUE, FILL_GREEN, FILL_PURPLE } from "@/lib/ui/fills";
import { cn } from "@/lib/utils";

const TAB = "inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold";

export function LibraryTabs({ tab }: { tab: "forms" | "noa" | "platform" | "corrections" }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <Link href="/libraries" className={cn(TAB, tab === "forms" ? FILL_PURPLE : "text-muted-foreground hover:bg-muted")}>
        <FileStack className="h-3.5 w-3.5" />
        Forms
      </Link>
      <Link href="/libraries?tab=noa" className={cn(TAB, tab === "noa" ? FILL_BLUE : "text-muted-foreground hover:bg-muted")}>
        <ShieldCheck className="h-3.5 w-3.5" />
        NOA
      </Link>
      <Link href="/libraries?tab=platform" className={cn(TAB, tab === "platform" ? FILL_GREEN : "text-muted-foreground hover:bg-muted")}>
        <Building2 className="h-3.5 w-3.5" />
        Building depts
      </Link>
      <Link href="/libraries?tab=corrections" className={cn(TAB, tab === "corrections" ? FILL_AMBER : "text-muted-foreground hover:bg-muted")}>
        <MessageSquareWarning className="h-3.5 w-3.5" />
        Corrections
      </Link>
    </div>
  );
}
