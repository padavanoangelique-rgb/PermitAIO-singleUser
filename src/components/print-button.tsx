"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const STYLE_ID = "permitaio-print-orientation";

export type PrintOrientation = "portrait" | "landscape";

/** Sets @page size, then opens the browser print dialog. */
export function printPage(orientation: PrintOrientation = "portrait") {
  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement("style");
    style.id = STYLE_ID;
    document.head.appendChild(style);
  }
  style.textContent = `@page { size: letter ${orientation}; margin: 0.4in; }`;
  document.documentElement.classList.toggle("print-landscape", orientation === "landscape");

  const cleanup = () => {
    document.documentElement.classList.remove("print-landscape");
    window.removeEventListener("afterprint", cleanup);
  };
  window.removeEventListener("afterprint", cleanup);
  window.addEventListener("afterprint", cleanup);
  window.print();
}

export function PrintButton({ label = "Print report" }: { label?: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Printer className="h-4 w-4" /> {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => printPage("portrait")}>
          Portrait
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => printPage("landscape")}>
          Landscape (horizontal)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
