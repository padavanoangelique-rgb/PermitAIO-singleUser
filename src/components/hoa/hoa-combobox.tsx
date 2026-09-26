"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export interface HoaOption {
  id: string;
  name: string;
  mgmt_co: string | null;
}

// Searchable HOA picker — a plain shadcn <Select> is unusable with 500+
// options, so this is a lightweight combobox (Popover + filtered list)
// built from primitives already in the design system.
export function HoaCombobox({
  hoas,
  value,
  onChange,
  placeholder = "Select an HOA…",
  disabled,
  onCreateNew,
}: {
  hoas: HoaOption[];
  value: string | null;
  onChange: (id: string) => void;
  placeholder?: string;
  disabled?: boolean;
  onCreateNew?: (initialName: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = hoas.find((h) => h.id === value) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? hoas.filter(
          (h) => h.name.toLowerCase().includes(q) || (h.mgmt_co ?? "").toLowerCase().includes(q),
        )
      : hoas;
    return list.slice(0, 200);
  }, [hoas, query]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          <span className={cn("truncate", !selected && "text-muted-foreground")}>
            {selected ? selected.name : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search HOA name or management co…"
            className="h-7 border-0 px-0 shadow-none focus-visible:ring-0"
          />
        </div>
        <ScrollArea className="h-64">
          <div className="p-1">
            {filtered.length === 0 && (
              <p className="px-2 py-4 text-center text-sm text-muted-foreground">No matches.</p>
            )}
            {onCreateNew && (
              <button
                type="button"
                onClick={() => {
                  const initial = query.trim();
                  onCreateNew(initial);
                  setOpen(false);
                  setQuery("");
                }}
                className="flex w-full items-center gap-2 rounded-sm border border-dashed px-2 py-2 text-left text-sm text-primary hover:bg-accent hover:text-accent-foreground"
              >
                <Plus className="h-4 w-4 shrink-0" />
                <span className="flex-1 truncate">
                  {query.trim() ? `Add new HOA: “${query.trim()}”` : "Add new HOA…"}
                </span>
              </button>
            )}
            {filtered.map((h) => (
              <button
                key={h.id}
                type="button"
                onClick={() => {
                  onChange(h.id);
                  setOpen(false);
                  setQuery("");
                }}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
              >
                <Check className={cn("h-4 w-4 shrink-0", h.id === value ? "opacity-100" : "opacity-0")} />
                <span className="flex-1 truncate">
                  {h.name}
                  {h.mgmt_co ? <span className="ml-1.5 text-xs text-muted-foreground">{h.mgmt_co}</span> : null}
                </span>
              </button>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
