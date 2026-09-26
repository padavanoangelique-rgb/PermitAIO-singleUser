"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { JOB_DATA_FIELDS } from "@/lib/forms/pdf-fill";
import { guessFieldMapping } from "@/lib/forms/guess-mapping";
import { Button } from "@/components/ui/button";
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
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  listPlatformFormFields,
  savePlatformFormMapping,
} from "@/lib/actions/platform-forms";

const UNMAPPED = "__unmapped__";

export function FieldMappingDialog({
  formId,
  title,
  open,
  onOpenChange,
}: {
  formId: string | null;
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);
  const [fields, setFields] = useState<{ name: string; type: string }[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !formId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    listPlatformFormFields(formId)
      .then((res) => {
        if (cancelled) return;
        if (res.error) {
          setError(res.error);
          setFields([]);
          return;
        }
        setFields(res.fields);
        setMapping(res.mapping ?? {});
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, formId]);

  const mappedCount = useMemo(
    () => Object.values(mapping).filter(Boolean).length,
    [mapping],
  );

  function setKey(pdfField: string, key: string) {
    setMapping((prev) => {
      const next = { ...prev };
      if (!key || key === UNMAPPED) delete next[pdfField];
      else next[pdfField] = key;
      return next;
    });
  }

  function applyGuess() {
    const guessed = guessFieldMapping(fields.map((f) => f.name));
    setMapping((prev) => ({ ...guessed, ...prev }));
    toast.success(`Guessed ${Object.keys(guessed).length} fields. Review before save.`);
  }

  function save() {
    if (!formId) return;
    startTransition(async () => {
      const res = await savePlatformFormMapping(formId, mapping);
      if (res.error) toast.error(res.error);
      else {
        toast.success(`Saved ${mappedCount} mapped fields`);
        onOpenChange(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-3xl flex-col">
        <DialogHeader>
          <DialogTitle>Map fields — {title}</DialogTitle>
          <DialogDescription>
            Each PDF box gets one job value. Name, address, folio, and contractor
            info typed on the job will fill every mapped box on generate.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Reading PDF fields…
          </div>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : fields.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            This PDF has no fillable fields (scan or flattened). It will still
            attach to the package; nothing to map.
          </p>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {fields.length} fields · {mappedCount} mapped
              </span>
              <Button size="sm" variant="outline" onClick={applyGuess}>
                Auto-guess name / address
              </Button>
            </div>
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-1 pr-2 font-medium">PDF field</th>
                  <th className="py-1 pr-2 font-medium">Type</th>
                  <th className="py-1 font-medium">Job data</th>
                </tr>
              </thead>
              <tbody>
                {fields.map((f) => (
                  <tr key={f.name} className="border-t">
                    <td className="py-1.5 pr-2 font-mono text-xs">{f.name}</td>
                    <td className="py-1.5 pr-2 text-xs text-muted-foreground">
                      {f.type.replace(/^PDF/, "")}
                    </td>
                    <td className="py-1.5">
                      <Select
                        value={mapping[f.name] || UNMAPPED}
                        onValueChange={(v) => setKey(f.name, v)}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={UNMAPPED}>— not mapped —</SelectItem>
                          {JOB_DATA_FIELDS.map((d) => (
                            <SelectItem key={d.key} value={d.key}>
                              {d.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={isPending || loading || !!error}>
            {isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
            Save mapping
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
