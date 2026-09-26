"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const TARGET_FIELD_OPTIONS = [
  { value: "_ignore", label: "Ignore this column" },
  { value: "client_name", label: "Client name" },
  { value: "job_number", label: "Job # (required as match key)" },
  { value: "address", label: "Address" },
  { value: "folio_number", label: "Folio number" },
  { value: "trade_type", label: "Trade type" },
  { value: "contract_value", label: "Contract value" },
  { value: "permit_number", label: "Permit number" },
  { value: "jurisdiction", label: "Jurisdiction" },
  { value: "stage", label: "Stage" },
  { value: "sub_status", label: "Sub-status" },
  { value: "sale_date", label: "Sale date" },
  { value: "assigned_date", label: "Assigned date" },
  { value: "submitted_date", label: "Submitted date" },
  { value: "approved_date", label: "Approved date" },
  { value: "noc_date", label: "NOC date" },
  { value: "permit_tech", label: "Permit tech" },
  { value: "noc_status", label: "NOC status" },
  { value: "city", label: "City" },
  { value: "notes", label: "Notes" },
];

interface Tab {
  title: string;
  sheetId: number;
}

interface ColumnRow {
  index: number;
  header: string;
  targetField: string;
}

export function ConnectSheetWizard({
  orgId,
  grantId,
  editingConnection,
}: {
  orgId: string;
  grantId: string | null;
  editingConnection?: {
    id: string;
    displayName: string;
    spreadsheetId: string;
    spreadsheetName: string;
    tabName: string;
    priority: number;
  };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"input" | "tabs" | "mapping">("input");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [spreadsheetInput, setSpreadsheetInput] = useState(editingConnection?.spreadsheetId ?? "");
  const [spreadsheetId, setSpreadsheetId] = useState(editingConnection?.spreadsheetId ?? "");
  const [spreadsheetName, setSpreadsheetName] = useState(editingConnection?.spreadsheetName ?? "");
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [tabName, setTabName] = useState(editingConnection?.tabName ?? "");
  const [displayName, setDisplayName] = useState(editingConnection?.displayName ?? "");
  const [priority, setPriority] = useState(editingConnection?.priority ?? 100);

  const [headerRow] = useState(1);
  const [columns, setColumns] = useState<ColumnRow[]>([]);
  const [sampleRows, setSampleRows] = useState<string[][]>([]);
  const [matchKeyIndex, setMatchKeyIndex] = useState<number | null>(null);

  if (!grantId) {
    return (
      <form action="/api/admin/sheets/connect" method="get">
        <input type="hidden" name="orgId" value={orgId} />
        <Button type="submit">Connect Google account</Button>
      </form>
    );
  }

  async function loadTabs() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/sheets/tabs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ grantId, spreadsheetUrlOrId: spreadsheetInput }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't load tabs.");
      setSpreadsheetId(data.spreadsheetId);
      setSpreadsheetName(data.spreadsheetName);
      setTabs(data.tabs);
      if (!displayName) setDisplayName(data.spreadsheetName);
      setStep("tabs");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load tabs.");
    } finally {
      setBusy(false);
    }
  }

  async function loadPreview() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/sheets/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ grantId, spreadsheetId, tabName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't preview that tab.");
      const cols: ColumnRow[] = (data.headers as string[]).map((header, index) => ({
        index,
        header,
        targetField: data.suggestions[index] ?? "_ignore",
      }));
      setColumns(cols);
      setSampleRows(data.sampleRows);
      const jobNumberCol = cols.find((c) => c.targetField === "job_number");
      setMatchKeyIndex(jobNumberCol ? jobNumberCol.index : null);
      setStep("mapping");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't preview that tab.");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (matchKeyIndex === null) {
      setError("Pick which column is the Job # — that's how rows get matched to jobs.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const mappings = columns
        .filter((c) => c.targetField !== "_ignore")
        .map((c) => ({
          column_index: c.index,
          column_header: c.header,
          target_field: c.index === matchKeyIndex ? "job_number" : c.targetField,
          is_match_key: c.index === matchKeyIndex,
        }));

      const res = await fetch("/api/admin/sheets/mapping", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          connectionId: editingConnection?.id,
          orgId,
          grantId,
          displayName,
          spreadsheetId,
          spreadsheetName,
          tabName,
          tabSheetId: tabs.find((t) => t.title === tabName)?.sheetId ?? null,
          priority,
          headerRow,
          mappings,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't save the mapping.");
      setOpen(false);
      setStep("input");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the mapping.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant={editingConnection ? "outline" : "default"} size="sm">
          {editingConnection ? "Edit mapping" : "Add sheet"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-heading">Connect a Google Sheet</DialogTitle>
          <DialogDescription>Read-only — PermitAIO never writes back to the sheet.</DialogDescription>
        </DialogHeader>

        {step === "input" && (
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="sheet_url">Spreadsheet URL or ID</Label>
              <Input
                id="sheet_url"
                value={spreadsheetInput}
                onChange={(e) => setSpreadsheetInput(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/..."
              />
            </div>
          </div>
        )}

        {step === "tabs" && (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">{spreadsheetName}</p>
            <div className="space-y-1.5">
              <Label htmlFor="tab_select">Tab</Label>
              <Select value={tabName} onValueChange={setTabName}>
                <SelectTrigger id="tab_select">
                  <SelectValue placeholder="Choose a tab…" />
                </SelectTrigger>
                <SelectContent>
                  {tabs.map((tab) => (
                    <SelectItem key={tab.sheetId} value={tab.title}>
                      {tab.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {step === "mapping" && (
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="display_name">Display name</Label>
                <Input id="display_name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="priority">Priority (lower wins conflicts)</Label>
                <Input
                  id="priority"
                  type="number"
                  value={priority}
                  onChange={(e) => setPriority(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="max-h-72 overflow-y-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Column</TableHead>
                    <TableHead>Sample</TableHead>
                    <TableHead>Maps to</TableHead>
                    <TableHead>Job #</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {columns.map((col) => (
                    <TableRow key={col.index}>
                      <TableCell className="font-medium">{col.header || `Column ${col.index + 1}`}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {sampleRows[0]?.[col.index] ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={col.targetField}
                          onValueChange={(value) =>
                            setColumns((prev) =>
                              prev.map((c) => (c.index === col.index ? { ...c, targetField: value } : c)),
                            )
                          }
                        >
                          <SelectTrigger className="w-48">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TARGET_FIELD_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <input
                          type="radio"
                          name="match_key"
                          checked={matchKeyIndex === col.index}
                          onChange={() => setMatchKeyIndex(col.index)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          {step === "input" && (
            <Button type="button" onClick={loadTabs} disabled={busy || !spreadsheetInput}>
              {busy ? "Loading…" : "Load tabs"}
            </Button>
          )}
          {step === "tabs" && (
            <Button type="button" onClick={loadPreview} disabled={busy || !tabName}>
              {busy ? "Loading…" : "Preview"}
            </Button>
          )}
          {step === "mapping" && (
            <Button type="button" onClick={save} disabled={busy}>
              {busy ? "Saving…" : "Save mapping"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
