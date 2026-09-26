"use client";

import { TAP_BLUE } from "@/lib/ui/chrome";

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className={TAP_BLUE}>
      Print report
    </button>
  );
}
