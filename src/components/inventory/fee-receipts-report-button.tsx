"use client";

import { useState } from "react";
import { Loader2, Receipt } from "lucide-react";
import { fetchOrgFeesAll, fetchOrgFeesInRange } from "@/lib/inventory/fees";
import { buildFeeReceiptsRangeReportPdf, downloadPdfBytes } from "@/lib/inventory/fee-report-pdf";
import { displayNameOnly, type TechNameMap } from "@/lib/tech-labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type Period = "day" | "week" | "range" | "all";

/**
 * Cross-job accounting tool for Permit Inventory: pick a day, a rolling
 * week, a custom date range, or every fee ever recorded (all-time) — then
 * download every fee receipt paid in that window as one stamped PDF for
 * handing to accounting. Reads only from job_fees; does not touch jobs
 * data or any existing report.
 */
export function FeeReceiptsReportButton({
  orgId,
  orgName,
  techNames,
}: {
  orgId: string;
  orgName: string;
  techNames?: TechNameMap;
}) {
  const [date, setDate] = useState(todayIso());
  const [fromDate, setFromDate] = useState(todayIso());
  const [toDate, setToDate] = useState(todayIso());
  const [building, setBuilding] = useState<Period | null>(null);

  async function build(period: Period) {
    setBuilding(period);
    try {
      let start = date || todayIso();
      let end = date || todayIso();
      let rangeLabel = "Daily receipts";
      if (period === "week") {
        end = date || todayIso();
        const d = new Date(`${end}T00:00:00`);
        d.setDate(d.getDate() - 6);
        start = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        rangeLabel = "Weekly receipts";
      } else if (period === "range") {
        start = fromDate || todayIso();
        end = toDate || todayIso();
        rangeLabel = "Custom range receipts";
      }

      const raw = period === "all" ? await fetchOrgFeesAll(orgId) : await fetchOrgFeesInRange(orgId, start, end);
      if (raw.length === 0) {
        const emptyMessage =
          period === "all"
            ? "No fees recorded for this organization yet."
            : `No fees recorded for ${period === "day" ? "that day" : period === "week" ? "that week" : "that range"}.`;
        alert(emptyMessage);
        return;
      }

      const rows = raw.map((row) => ({
        fee: row,
        jobNumber: row.job_number,
        clientName: row.client_name,
        permitTech: displayNameOnly(row.permit_tech, techNames),
      }));

      let reportStart = start;
      let reportEnd = end;
      if (period === "all") {
        reportStart = rows[0].fee.paid_date;
        reportEnd = rows[rows.length - 1].fee.paid_date;
        rangeLabel = "All-time receipts";
      }

      const bytes = await buildFeeReceiptsRangeReportPdf(orgName, rangeLabel, reportStart, reportEnd, rows);
      const filenameRange =
        period === "day" ? start : period === "all" ? "all-time" : `${start}_to_${end}`;
      downloadPdfBytes(bytes, `Fee Receipts ${filenameRange}.pdf`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Couldn't build that receipts report.");
    } finally {
      setBuilding(null);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          {building ? <Loader2 className="animate-spin" /> : <Receipt />}
          Receipts
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 p-2" onCloseAutoFocus={(e) => e.preventDefault()}>
        <DropdownMenuLabel className="px-1 py-1">Fee receipts</DropdownMenuLabel>
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="mb-1.5 h-8"
          onKeyDown={(e) => e.stopPropagation()}
        />
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start"
          onClick={() => build("day")}
          disabled={building !== null}
        >
          Day's receipts
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start"
          onClick={() => build("week")}
          disabled={building !== null}
        >
          Week's receipts
        </Button>
        <DropdownMenuSeparator />
        <div className="mb-1.5 flex items-center gap-1.5 px-1">
          <Input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="h-8"
            onKeyDown={(e) => e.stopPropagation()}
          />
          <span className="text-xs text-muted-foreground">to</span>
          <Input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="h-8"
            onKeyDown={(e) => e.stopPropagation()}
          />
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start"
          onClick={() => build("range")}
          disabled={building !== null}
        >
          Custom range
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start"
          onClick={() => build("all")}
          disabled={building !== null}
        >
          All-time
        </Button>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
