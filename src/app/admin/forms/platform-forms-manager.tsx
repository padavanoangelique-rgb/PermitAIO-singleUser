"use client";

import { useMemo, useState, useTransition, useRef } from "react";
import { FORM_COUNTIES, type FormCounty } from "@/lib/forms/folio";
import { ALL_JURISDICTIONS } from "@/lib/forms/jurisdictions";
import { DOC_TYPE_LABELS } from "@/lib/forms/match";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, Upload, Loader2 } from "lucide-react";
import {
  uploadPlatformForm,
  updatePlatformForm,
  deletePlatformForm,
} from "@/lib/actions/platform-forms";

export interface PlatformFormRow {
  id: string;
  county: FormCounty;
  jurisdiction_name: string | null;
  jurisdiction_code: string | null;
  doc_type: string;
  title: string;
  description: string | null;
  file_name: string | null;
  trade: string;
  sort_order: number;
  visibility: string;
}

const DOC_TYPES = Object.keys(DOC_TYPE_LABELS);
const TRADES = ["general", "windows", "roofing", "windows_doors"];

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  // btoa in chunks to avoid call-stack limits on large PDFs.
  const bytes = new Uint8Array(buf);
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + CHUNK)),
    );
  }
  return btoa(bin);
}

export function PlatformFormsManager({ rows }: { rows: PlatformFormRow[] }) {
  const [query, setQuery] = useState("");
  const [countyFilter, setCountyFilter] = useState<FormCounty | "all">("all");
  const [openNew, setOpenNew] = useState(false);
  const [editing, setEditing] = useState<PlatformFormRow | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (countyFilter !== "all" && r.county !== countyFilter) return false;
      if (!q) return true;
      return (
        r.title.toLowerCase().includes(q) ||
        (r.jurisdiction_name ?? "").toLowerCase().includes(q) ||
        (r.file_name ?? "").toLowerCase().includes(q) ||
        r.doc_type.toLowerCase().includes(q)
      );
    });
  }, [rows, query, countyFilter]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search title, jurisdiction, filename…"
          className="max-w-sm"
        />
        <Select
          value={countyFilter}
          onValueChange={(v) => setCountyFilter(v as FormCounty | "all")}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All counties</SelectItem>
            {FORM_COUNTIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto">
          <Button onClick={() => setOpenNew(true)}>
            <Plus className="mr-1 h-4 w-4" />
            New form
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">County</th>
              <th className="px-3 py-2 font-medium">Jurisdiction</th>
              <th className="px-3 py-2 font-medium">Doc type</th>
              <th className="px-3 py-2 font-medium">Title</th>
              <th className="px-3 py-2 font-medium">File</th>
              <th className="px-3 py-2 font-medium">Trade</th>
              <th className="px-3 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                  No forms match this filter.
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-3 py-2">{r.county}</td>
                  <td className="px-3 py-2">
                    {r.jurisdiction_name ?? (
                      <span className="text-muted-foreground">(county-wide)</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant="outline">
                      {DOC_TYPE_LABELS[r.doc_type] ?? r.doc_type}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">{r.title}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {r.file_name ?? (
                      <span className="text-destructive">no file</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs">{r.trade}</td>
                  <td className="px-3 py-2">
                    <RowActions row={r} onEdit={() => setEditing(r)} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <NewFormDialog open={openNew} onOpenChange={setOpenNew} />
      <EditFormDialog row={editing} onOpenChange={(o) => !o && setEditing(null)} />
    </div>
  );
}

function RowActions({ row, onEdit }: { row: PlatformFormRow; onEdit: () => void }) {
  const [isPending, startTransition] = useTransition();
  return (
    <div className="flex gap-1">
      <Button size="sm" variant="ghost" onClick={onEdit}>
        Edit
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="text-destructive"
        disabled={isPending}
        onClick={() => {
          if (!confirm(`Delete "${row.title}"? This affects every org.`)) return;
          startTransition(async () => {
            const res = await deletePlatformForm(row.id);
            if (res.error) toast.error(res.error);
            else toast.success("Form deleted");
          });
        }}
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Trash2 className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}

function NewFormDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [county, setCounty] = useState<FormCounty>("Broward");
  const [jurisdictionName, setJurisdictionName] = useState("");
  const [jurisdictionCode, setJurisdictionCode] = useState("");
  const [docType, setDocType] = useState("addendum");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [trade, setTrade] = useState("general");
  const [sortOrder, setSortOrder] = useState("100");
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setCounty("Broward");
    setJurisdictionName("");
    setJurisdictionCode("");
    setDocType("addendum");
    setTitle("");
    setDescription("");
    setTrade("general");
    setSortOrder("100");
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function submit() {
    if (!title.trim()) return toast.error("Title is required.");
    if (!file) return toast.error("Pick a PDF file first.");
    startTransition(async () => {
      const fileDataBase64 = await fileToBase64(file);
      const res = await uploadPlatformForm({
        county,
        jurisdictionName: jurisdictionName || null,
        jurisdictionCode: jurisdictionCode || null,
        docType,
        title,
        description: description || null,
        fileName: file.name,
        fileDataBase64,
        trade,
        sortOrder: Number(sortOrder) || 100,
      });
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Form uploaded");
        reset();
        onOpenChange(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>New platform form</DialogTitle>
          <DialogDescription>
            Uploaded here it becomes available to every organization&apos;s
            Permit Package Generator.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>County</Label>
            <Select
              value={county}
              onValueChange={(v) => {
                setCounty(v as FormCounty);
                setJurisdictionName("");
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FORM_COUNTIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Doc type</Label>
            <Select value={docType} onValueChange={setDocType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DOC_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {DOC_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Jurisdiction (blank = county-wide)</Label>
            <Select
              value={jurisdictionName}
              onValueChange={(v) => setJurisdictionName(v === "__countywide__" ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="County-wide" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__countywide__">
                  County-wide (blank)
                </SelectItem>
                {ALL_JURISDICTIONS[county].map((j) => (
                  <SelectItem key={j} value={j}>
                    {j}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Jurisdiction code (optional)</Label>
            <Input
              value={jurisdictionCode}
              onChange={(e) => setJurisdictionCode(e.target.value)}
              placeholder="e.g. 0611"
            />
          </div>
          <div className="col-span-2 space-y-1">
            <Label>Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Boynton Beach Retrofit Window & Door Affidavit"
            />
          </div>
          <div className="col-span-2 space-y-1">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
          <div className="space-y-1">
            <Label>Trade</Label>
            <Select value={trade} onValueChange={setTrade}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRADES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Sort order</Label>
            <Input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
            />
          </div>
          <div className="col-span-2 space-y-1">
            <Label>PDF file</Label>
            <Input
              ref={fileRef}
              type="file"
              accept="application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file && (
              <p className="text-xs text-muted-foreground">
                {file.name} — {(file.size / 1024).toFixed(0)} kB
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={isPending}>
            {isPending ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-1 h-4 w-4" />
            )}
            Upload
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditFormDialog({
  row,
  onOpenChange,
}: {
  row: PlatformFormRow | null;
  onOpenChange: (o: boolean) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [docType, setDocType] = useState("addendum");
  const [trade, setTrade] = useState("general");
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // sync form state to row when it becomes non-null
  useMemo(() => {
    if (row) {
      setTitle(row.title);
      setDescription(row.description ?? "");
      setDocType(row.doc_type);
      setTrade(row.trade);
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }, [row]);

  if (!row) return null;

  function submit() {
    if (!row) return;
    startTransition(async () => {
      const patch: Parameters<typeof updatePlatformForm>[0] = {
        id: row.id,
        title,
        description: description || null,
        docType,
        trade,
      };
      if (file) {
        patch.fileDataBase64 = await fileToBase64(file);
        patch.fileName = file.name;
      }
      const res = await updatePlatformForm(patch);
      if (res.error) toast.error(res.error);
      else {
        toast.success("Form updated");
        onOpenChange(false);
      }
    });
  }

  return (
    <Dialog open={!!row} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit form</DialogTitle>
          <DialogDescription>
            {row.county} · {row.jurisdiction_name ?? "(county-wide)"} ·{" "}
            {row.file_name ?? "no file"}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="col-span-2 space-y-1">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
          <div className="space-y-1">
            <Label>Doc type</Label>
            <Select value={docType} onValueChange={setDocType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DOC_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {DOC_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Trade</Label>
            <Select value={trade} onValueChange={setTrade}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRADES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 space-y-1">
            <Label>Replace file (optional)</Label>
            <Input
              ref={fileRef}
              type="file"
              accept="application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file && (
              <p className="text-xs text-muted-foreground">
                Will replace with {file.name} — {(file.size / 1024).toFixed(0)} kB
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={isPending}>
            {isPending ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
