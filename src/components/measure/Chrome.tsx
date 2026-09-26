"use client";
import { useEffect, useState, type ReactNode } from "react";
import {
  Check,
  ClipboardList,
  DoorOpen,
  Download,
  Eraser,
  FlipHorizontal,
  FolderOpen,
  Grid3x3,
  House,
  Layers,
  MousePointer2,
  PenLine,
  PenTool,
  Plus,
  Redo2,
  Send,
  Settings2,
  Trash2,
  Undo2,
  AppWindow,
  Ruler,
  Maximize2,
  Minus,
  X,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/measure/measure-button";
import { cn } from "@/lib/utils";
import { formatFeet, formatLength, parseLength, wallLength } from "@/lib/measure/geometry";
import { exportMeasureJson, exportPlanPng, exportScheduleCsv } from "@/lib/measure/export";
import { openingSizeLabel, openingUnit, scheduleRows } from "@/lib/measure/schedule";
import { readTheme } from "@/lib/measure/render";
import { usePlanStore } from "@/lib/measure/store";
import { DOOR_CONFIGS, ROOM_STAMPS, WINDOW_CONFIGS, PX_PER_FOOT, type Tool } from "@/lib/measure/types";
import {
  buildMeasurePayload,
  lookupJob,
  saveMeasureToJob,
  submitMeasureToJob,
} from "@/lib/measure/integration";

const TOOLS: { id: Tool; label: string; icon: typeof PenLine }[] = [
  { id: "draw", label: "Draw", icon: PenLine },
  { id: "door", label: "Door", icon: DoorOpen },
  { id: "window", label: "Window", icon: AppWindow },
  { id: "size", label: "Size", icon: Ruler },
  { id: "label", label: "Room", icon: House },
  { id: "schedule", label: "Schedule", icon: ClipboardList },
  { id: "erase", label: "Erase", icon: Eraser },
  { id: "select", label: "Select", icon: MousePointer2 },
];

export function Chrome() {
  const tool = usePlanStore((s) => s.tool);
  const setTool = usePlanStore((s) => s.setTool);
  const setSheet = usePlanStore((s) => s.setSheet);
  const sheet = usePlanStore((s) => s.sheet);
  const plan = usePlanStore((s) => s.current());
  const pencilMode = usePlanStore((s) => s.pencilMode);
  const ortho = usePlanStore((s) => s.ortho);
  const needsJob = !plan.jobNumber.trim();
  const selection = usePlanStore((s) => s.selection);
  const past = usePlanStore((s) => s.past);
  const future = usePlanStore((s) => s.future);

  const pendingStamp = usePlanStore((s) => s.pendingStamp);
  const pendingRect = usePlanStore((s) => s.pendingRect);
  const hint =
    pendingRect
      ? `Tap a corner to place ${formatFeet(pendingRect.w)} × ${formatFeet(pendingRect.h)}.`
      : tool === "draw"
        ? "Sketch the house first. Number windows, then tap Size to type lengths."
        : tool === "door"
          ? "Tap a wall to place a door. Size it after you number the house."
          : tool === "window"
            ? "Tap a wall to number a window. Type sizes in Size when the house is numbered."
            : tool === "size"
              ? "Tap a wall, a length, or a row below. Type the measured size. Finger works; iPad pencil is for drawing."
              : tool === "schedule"
              ? "Every opening on this job."
              : tool === "erase"
                ? "Stroke through a wall to remove it."
                : tool === "label"
                  ? pendingStamp
                    ? `Tap a room to drop ${pendingStamp}.`
                    : "Pick a room stamp, then tap the plan."
                  : pencilMode
                    ? "Pencil draws. Finger moves the page."
                    : "Tap a mark to type width × height.";

  return (
    <>
      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 p-3 safe-top">
        <div className="pointer-events-auto flex items-center gap-1 rounded-2xl bg-chrome p-1.5 text-chrome-fg shadow-[var(--shadow-chrome)]">
          <Link
            href={plan.jobNumber.trim() ? `/measure?job=${encodeURIComponent(plan.jobNumber)}` : "/measure"}
            aria-label="Done"
            className="inline-flex size-11 items-center justify-center rounded-xl text-ink hover:bg-ink/6"
          >
            <X className="size-5" />
          </Link>
          <Button
            variant="chrome"
            size="icon"
            aria-label="Plans"
            onClick={() => setSheet("plans")}
          >
            <FolderOpen className="size-5" />
          </Button>
          <div className="px-2">
            <div className="font-heading text-sm leading-tight tracking-tight">
              Measure Tech
            </div>
            <button
              type="button"
              onClick={() => setSheet("plans")}
              className="max-w-36 truncate text-left font-mono text-xs text-primary"
            >
              {plan.jobNumber ? `Job ${plan.jobNumber}` : "Add job #"}
            </button>
          </div>
        </div>

        <div className="pointer-events-auto flex items-center gap-1 rounded-2xl bg-chrome p-1.5 text-chrome-fg shadow-[var(--shadow-chrome)]">
          <Button
            variant="chrome"
            size="icon"
            aria-label="Undo"
            disabled={past.length === 0}
            onClick={() => usePlanStore.getState().undo()}
          >
            <Undo2 className="size-5" />
          </Button>
          <Button
            variant="chrome"
            size="icon"
            aria-label="Redo"
            disabled={future.length === 0}
            onClick={() => usePlanStore.getState().redo()}
          >
            <Redo2 className="size-5" />
          </Button>
          <Button
            variant="chrome"
            size="icon"
            data-active={pencilMode}
            aria-label="Pencil mode"
            onClick={() => usePlanStore.getState().setPencilMode(!pencilMode)}
          >
            <PenTool className="size-5" />
          </Button>
          <Button
            variant="chrome"
            size="icon"
            aria-label="Export"
            onClick={async () => {
              const theme = readTheme(document.documentElement);
              await exportPlanPng(usePlanStore.getState().current(), theme);
            }}
          >
            <Download className="size-5" />
          </Button>
          <Button
            variant="chrome"
            size="icon"
            aria-label="Settings"
            onClick={() => setSheet("settings")}
          >
            <Settings2 className="size-5" />
          </Button>
        </div>
      </header>

      <ZoomRail />

      {!needsJob && !selection && (
        <div className="pointer-events-none absolute inset-x-0 top-20 z-20 flex justify-center px-3">
          <div className="rounded-full bg-paper/85 px-3 py-1.5 text-center text-xs text-muted shadow-[var(--shadow-border)] backdrop-blur-sm">
            {hint}
          </div>
        </div>
      )}

      {selection && <SelectionBar />}

      <nav className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center p-3 safe-bottom">
        <div className="pointer-events-auto flex items-center gap-0.5 overflow-x-auto rounded-[22px] bg-chrome p-1.5 text-chrome-fg shadow-[var(--shadow-chrome)]">
          {TOOLS.map((t) => {
            const Icon = t.icon;
            const active = t.id === "schedule" ? sheet === "schedule" : tool === t.id;
            return (
              <button
                key={t.id}
                type="button"
                aria-label={t.label}
                data-active={active}
                onClick={() => {
                  if (t.id === "schedule") {
                    setTool("select");
                    setSheet("schedule");
                    return;
                  }
                  setTool(t.id);
                }}
                className={cn(
                  "flex size-12 min-w-12 flex-col items-center justify-center rounded-[14px] text-ink transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.96]",
                  active && "bg-primary text-primary-foreground",
                )}
              >
                <Icon className="size-5" strokeWidth={2.25} />
              </button>
            );
          })}
        </div>
      </nav>

      {tool === "label" && (
        <div className="pointer-events-none absolute inset-x-0 bottom-24 z-20 flex justify-center px-3 pb-[env(safe-area-inset-bottom)] sm:bottom-8">
          <RoomStampTray />
        </div>
      )}

      {tool === "draw" && (
        <div className="pointer-events-none absolute inset-x-0 bottom-24 z-20 flex flex-wrap items-end justify-between gap-2 px-3 pb-[env(safe-area-inset-bottom)] sm:bottom-8">
          <button
            type="button"
            onClick={() => usePlanStore.getState().setOrtho(!ortho)}
            className={cn(
              "pointer-events-auto flex h-10 items-center gap-2 rounded-full bg-paper px-3 text-xs font-medium text-ink shadow-[var(--shadow-border)]",
              ortho && "bg-ink text-paper",
            )}
          >
            <Grid3x3 className="size-3.5" />
            {ortho ? "Ortho on" : "Ortho off"}
          </button>
          <RoomSizeBar />
        </div>
      )}

      {tool === "size" && <SizePassBar />}

      <PlansSheet open={sheet === "plans"} />
      <ScheduleSheet open={sheet === "schedule"} />
      <OpeningSheet open={sheet === "opening"} />
      <SettingsSheet open={sheet === "settings"} />
      <LabelSheet open={sheet === "label"} />
      {!plan.jobNumber.trim() && <JobGate />}
    </>
  );
}

function ZoomRail() {
  function zoomBy(factor: number) {
    const s = usePlanStore.getState();
    const cam = s.camera;
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const worldX = (cx - cam.panX) / (PX_PER_FOOT * cam.zoom);
    const worldY = (cy - cam.panY) / (PX_PER_FOOT * cam.zoom);
    const zoom = Math.max(0.22, Math.min(5.5, cam.zoom * factor));
    s.setCamera({
      zoom,
      panX: cx - worldX * PX_PER_FOOT * zoom,
      panY: cy - worldY * PX_PER_FOOT * zoom,
    });
  }

  return (
    <div className="pointer-events-none absolute right-3 top-[40%] z-20 -translate-y-1/2 pb-[env(safe-area-inset-bottom)]">
      <div className="pointer-events-auto flex flex-col rounded-2xl bg-chrome p-1 text-chrome-fg shadow-[var(--shadow-chrome)]">
        <Button variant="chrome" size="icon" aria-label="Zoom in" onClick={() => zoomBy(1.25)}>
          <Plus className="size-5" />
        </Button>
        <Button
          variant="chrome"
          size="icon"
          aria-label="Fit drawing"
          onClick={() => usePlanStore.getState().fitView(window.innerWidth, window.innerHeight)}
        >
          <Maximize2 className="size-5" />
        </Button>
        <Button variant="chrome" size="icon" aria-label="Zoom out" onClick={() => zoomBy(0.8)}>
          <Minus className="size-5" />
        </Button>
      </div>
    </div>
  );
}

function DimInput({
  valueFeet,
  onCommit,
  onDraft,
  label,
  tone = "ink",
  autoFocus,
  className,
  unit = "feet",
}: {
  valueFeet: number;
  onCommit: (feet: number) => void;
  onDraft?: (feet: number) => void;
  label: string;
  tone?: "ink" | "paper";
  autoFocus?: boolean;
  className?: string;
  unit?: "feet" | "inches";
}) {
  const [text, setText] = useState(formatLength(valueFeet, unit));
  useEffect(() => {
    setText(formatLength(valueFeet, unit));
  }, [valueFeet, unit]);

  const commit = () => {
    const n = parseLength(text, unit);
    if (n == null || n <= 0) {
      setText(formatLength(valueFeet, unit));
      return;
    }
    onCommit(n);
    setText(formatLength(n, unit));
  };

  return (
    <input
      aria-label={label}
      autoFocus={autoFocus}
      value={text}
      inputMode="decimal"
      enterKeyHint="done"
      autoCapitalize="off"
      autoCorrect="off"
      spellCheck={false}
      onChange={(e) => {
        setText(e.target.value);
        const n = parseLength(e.target.value, unit);
        if (n != null && n > 0) onDraft?.(n);
      }}
      onBlur={commit}
      onFocus={(e) => e.currentTarget.select()}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        e.stopPropagation();
      }}
      onPointerDown={(e) => e.stopPropagation()}
      className={cn(
        "h-11 min-w-[5.5rem] rounded-full px-3 text-center font-mono text-base outline-none",
        tone === "ink"
          ? "bg-paper/14 text-paper focus:bg-paper focus:text-ink"
          : "bg-paper-2 text-ink ring-1 ring-ink/10 focus:ring-2 focus:ring-accent",
        className,
      )}
    />
  );
}

function SizePassBar() {
  const plan = usePlanStore((s) => s.current());
  const selection = usePlanStore((s) => s.selection);
  const walls = plan.walls.filter((w) => wallLength(w) >= 1.5);
  const rows = scheduleRows(plan);
  if (walls.length === 0 && rows.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-24 z-20 px-3 pb-[env(safe-area-inset-bottom)]">
      <div className="pointer-events-auto mx-auto max-h-44 max-w-lg overflow-auto rounded-2xl bg-paper p-2 text-ink shadow-[var(--shadow-chrome)]">
        <p className="px-2 pb-1 text-xs text-muted">Tap a row, then type the size.</p>
        <ul className="space-y-1">
          {walls.map((w, i) => {
            const on = selection?.kind === "wall" && selection.id === w.id;
            return (
              <li key={w.id}>
                <button
                  type="button"
                  onClick={() => usePlanStore.getState().setSelection({ kind: "wall", id: w.id })}
                  className={cn(
                    "flex min-h-11 w-full items-center justify-between rounded-xl px-3 text-left text-sm",
                    on ? "bg-primary text-primary-foreground" : "hover:bg-paper-2",
                  )}
                >
                  <span>Wall {i + 1}</span>
                  <span className="font-mono">{formatFeet(wallLength(w))}</span>
                </button>
              </li>
            );
          })}
          {rows.map((o) => {
            const on = selection?.kind === "opening" && selection.id === o.id;
            return (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => usePlanStore.getState().setSelection({ kind: "opening", id: o.id })}
                  className={cn(
                    "flex min-h-11 w-full items-center justify-between rounded-xl px-3 text-left text-sm",
                    on ? "bg-primary text-primary-foreground" : "hover:bg-paper-2",
                  )}
                >
                  <span className="font-mono">
                    {o.mark} {o.type}
                  </span>
                  <span className="font-mono">{openingSizeLabel(o)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function SelectionBar() {
  const selection = usePlanStore((s) => s.selection);
  const plan = usePlanStore((s) => s.current());
  if (!selection) return null;
  const wall =
    selection.kind === "wall" ? plan.walls.find((w) => w.id === selection.id) : null;
  const opening =
    selection.kind === "opening"
      ? plan.openings.find((o) => o.id === selection.id)
      : null;
  const roomStamp =
    selection.kind === "label" ? plan.labels.find((l) => l.id === selection.id) : null;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-32 z-20 flex justify-center px-3">
      <div className="pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-1 rounded-full bg-paper p-1 text-ink shadow-[var(--shadow-border)]">
        {wall && (
          <>
            <span className="pl-3 font-mono text-xs text-muted">L</span>
            <DimInput
              key={wall.id}
              label="Wall length"
              valueFeet={wallLength(wall)}
              autoFocus
              tone="paper"
              onCommit={(feet) => usePlanStore.getState().setWallLength(wall.id, feet)}
            />
          </>
        )}
        {opening && (
          <>
            <span className="pl-2 font-mono text-xs text-primary">{opening.mark}</span>
            <span className="font-mono text-xs text-muted">
              W{opening.type === "window" ? " in" : ""}
            </span>
            <DimInput
              key={`${opening.id}-w`}
              label={opening.type === "window" ? "Width in inches" : "Opening width"}
              valueFeet={opening.width}
              unit={openingUnit(opening.type)}
              tone="paper"
              onCommit={(feet) => usePlanStore.getState().setOpeningWidth(opening.id, feet)}
            />
            <span className="font-mono text-xs text-muted">
              H{opening.type === "window" ? " in" : ""}
            </span>
            <DimInput
              key={`${opening.id}-h`}
              label={opening.type === "window" ? "Height in inches" : "Opening height"}
              valueFeet={opening.height}
              unit={openingUnit(opening.type)}
              autoFocus
              tone="paper"
              onCommit={(feet) => usePlanStore.getState().setOpeningHeight(opening.id, feet)}
            />
            <Button
              variant="chrome"
              size="sm"
              className="h-10 rounded-full px-3"
              onClick={() => usePlanStore.getState().setSheet("opening")}
            >
              Edit
            </Button>
          </>
        )}
        {roomStamp && (
          <span className="pl-3 pr-1 text-sm">{roomStamp.text}</span>
        )}
        {selection.kind === "opening" && (
          <Button
            variant="chrome"
            size="sm"
            className="h-10 rounded-full px-3"
            onClick={() => usePlanStore.getState().flipOpening(selection.id)}
          >
            <FlipHorizontal className="size-4" />
            Flip
          </Button>
        )}
        <Button
          variant="chrome"
          size="sm"
          className="h-10 rounded-full px-3"
          onClick={() => usePlanStore.getState().deleteSelection()}
        >
          <Trash2 className="size-4" />
          Delete
        </Button>
      </div>
    </div>
  );
}

function RoomStampTray() {
  const pending = usePlanStore((s) => s.pendingStamp);
  return (
    <div className="pointer-events-auto flex max-w-full items-center gap-1 overflow-x-auto rounded-full bg-paper p-1 text-ink shadow-[var(--shadow-border)]">
      {ROOM_STAMPS.map((name) => {
        const on = pending === name;
        return (
          <button
            key={name}
            type="button"
            onClick={() =>
              usePlanStore.getState().setPendingStamp(on ? null : name)
            }
            className={cn(
              "h-10 shrink-0 rounded-full px-3 text-xs font-medium",
              on ? "bg-ink text-paper" : "text-ink hover:bg-ink/5",
            )}
          >
            {name}
          </button>
        );
      })}
      <button
        type="button"
        onClick={() => {
          usePlanStore.getState().setLabelDraft("");
          usePlanStore.getState().setSheet("label");
        }}
        className="flex h-10 shrink-0 items-center gap-1 rounded-full px-3 text-xs font-medium text-muted hover:bg-ink/5"
      >
        <Plus className="size-3.5" />
        Custom
      </button>
    </div>
  );
}

function RoomSizeBar() {
  const pending = usePlanStore((s) => s.pendingRect);
  const [w, setW] = useState(12);
  const [h, setH] = useState(10);

  useEffect(() => {
    if (pending) {
      setW(pending.w);
      setH(pending.h);
    }
  }, [pending]);

  return (
    <div className="pointer-events-auto flex items-center gap-1 rounded-full bg-paper p-1 text-ink shadow-[var(--shadow-border)]">
      <Ruler className="ml-2 size-3.5 text-muted" />
      <DimInput
        tone="paper"
        label="Room width"
        valueFeet={w}
        onDraft={setW}
        onCommit={(feet) => {
          setW(feet);
          if (pending) usePlanStore.getState().setPendingRect({ w: feet, h });
        }}
      />
      <span className="text-xs text-muted">×</span>
      <DimInput
        tone="paper"
        label="Room depth"
        valueFeet={h}
        onDraft={setH}
        onCommit={(feet) => {
          setH(feet);
          if (pending) usePlanStore.getState().setPendingRect({ w, h: feet });
        }}
      />
      <Button
        variant={pending ? "primary" : "ghost"}
        size="sm"
        className="h-10 rounded-full px-3"
        onClick={() => {
          if (pending) {
            usePlanStore.getState().setPendingRect(null);
            return;
          }
          usePlanStore.getState().setPendingRect({ w, h });
        }}
      >
        {pending ? "Cancel" : "Place"}
      </Button>
    </div>
  );
}

function SheetFrame({
  open,
  title,
  children,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-ink/40"
        onClick={() => usePlanStore.getState().setSheet("none")}
      />
      <div className="absolute inset-x-0 bottom-0 mx-auto max-w-lg rounded-t-2xl bg-paper px-5 safe-bottom-sheet pt-3 text-ink shadow-[var(--shadow-sheet)]">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-faint" />
        <h2 className="font-heading text-xl tracking-tight">{title}</h2>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

function PlansSheet({ open }: { open: boolean }) {
  const plans = usePlanStore((s) => s.plans);
  const currentId = usePlanStore((s) => s.currentId);
  const [name, setName] = useState("");
  const [job, setJob] = useState("");
  const [address, setAddress] = useState("");
  const current = usePlanStore((s) => s.current());

  useEffect(() => {
    setName(current.name);
    setJob(current.jobNumber);
    setAddress(current.address);
  }, [current.id, current.name, current.jobNumber, current.address, open]);

  return (
    <SheetFrame open={open} title="Jobs">
      <label className="block text-xs font-medium text-muted">Job number</label>
      <input
        value={job}
        onChange={(e) => setJob(e.target.value)}
        onBlur={() => usePlanStore.getState().setJobMeta({ jobNumber: job.trim() })}
        placeholder="1042"
        className="mt-1 h-11 w-full rounded-xl bg-paper-2 px-3 font-mono text-sm text-ink outline-none ring-1 ring-ink/10 focus:ring-2 focus:ring-accent"
      />
      <label className="mt-3 block text-xs font-medium text-muted">Address</label>
      <input
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        onBlur={() => usePlanStore.getState().setJobMeta({ address: address.trim() })}
        placeholder="Street, city"
        className="mt-1 h-11 w-full rounded-xl bg-paper-2 px-3 text-sm text-ink outline-none ring-1 ring-ink/10 focus:ring-2 focus:ring-accent"
      />
      <label className="mt-3 block text-xs font-medium text-muted">Plan name</label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => name.trim() && usePlanStore.getState().renamePlan(name.trim())}
        className="mt-1 h-11 w-full rounded-xl bg-paper-2 px-3 text-sm text-ink outline-none ring-1 ring-ink/10 focus:ring-2 focus:ring-accent"
      />
      <ul className="mt-4 max-h-56 space-y-1 overflow-auto">
        {plans.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => usePlanStore.getState().switchPlan(p.id)}
              className={cn(
                "flex h-12 w-full items-center justify-between rounded-xl px-3 text-left text-sm",
                p.id === currentId ? "bg-accent-soft text-ink" : "hover:bg-ink/5",
              )}
            >
              <span className="truncate">
                {p.jobNumber ? `Job ${p.jobNumber}` : p.name}
              </span>
              {p.id === currentId && <Check className="size-4 text-primary" />}
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          variant="primary"
          onClick={() => usePlanStore.getState().newPlan()}
        >
          <Plus className="size-4" />
          New job
        </Button>
        <Button variant="outline" onClick={() => usePlanStore.getState().duplicatePlan()}>
          <Layers className="size-4" />
          Duplicate
        </Button>
        <Button
          variant="outline"
          onClick={() => usePlanStore.getState().deletePlan(currentId)}
        >
          <Trash2 className="size-4" />
          Delete
        </Button>
      </div>
    </SheetFrame>
  );
}

function ScheduleSheet({ open }: { open: boolean }) {
  const plan = usePlanStore((s) => s.current());
  const rows = scheduleRows(plan);
  const [busy, setBusy] = useState<"save" | "submit" | null>(null);
  const [note, setNote] = useState("");

  return (
    <SheetFrame open={open} title="Window / door schedule">
      <p className="text-sm text-muted">
        {plan.jobNumber ? `Job ${plan.jobNumber}` : "Add a job number"} · {rows.length} opening
        {rows.length === 1 ? "" : "s"}
      </p>
      <div className="mt-3 max-h-64 overflow-auto">
        {rows.length === 0 ? (
          <p className="rounded-xl bg-paper-2 px-3 py-6 text-center text-sm text-muted">
            Tap Window or Door on a wall, then type size. Windows in inches.
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="font-mono text-xs text-muted">
              <tr>
                <th className="py-2 pr-2 font-medium">Mk</th>
                <th className="py-2 pr-2 font-medium">Type</th>
                <th className="py-2 pr-2 font-medium">Size</th>
                <th className="py-2 font-medium">Room</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.id}>
                  <td className="py-2 pr-2">
                    <button
                      type="button"
                      className="font-mono text-gold"
                      onClick={() => {
                        usePlanStore.getState().setSelection({ kind: "opening", id: o.id });
                        usePlanStore.getState().setSheet("opening");
                      }}
                    >
                      {o.mark}
                    </button>
                  </td>
                  <td className="py-2 pr-2 capitalize text-ink-soft">{o.config || o.type}</td>
                  <td className="py-2 pr-2 font-mono">{openingSizeLabel(o)}</td>
                  <td className="truncate py-2 text-muted">{o.room || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={async () => {
            const theme = readTheme(document.documentElement);
            await exportPlanPng(usePlanStore.getState().current(), theme);
          }}
        >
          <Download className="size-4" />
          Plan
        </Button>
        <Button variant="outline" onClick={() => exportScheduleCsv(usePlanStore.getState().current())}>
          CSV
        </Button>
        <Button variant="outline" onClick={() => exportMeasureJson(usePlanStore.getState().current())}>
          JSON
        </Button>
        <Button
          variant="accent"
          disabled={busy !== null}
          onClick={async () => {
            const payload = buildMeasurePayload(usePlanStore.getState().current());
            setBusy("submit");
            await submitMeasureToJob(payload);
            await saveMeasureToJob(payload);
            setBusy(null);
            setNote("Saved on this device. Claude Code will send this to the job.");
          }}
        >
          <Send className="size-4" />
          {busy ? "Saving…" : "Submit measure"}
        </Button>
      </div>
      {note && <p className="mt-3 text-xs text-muted">{note}</p>}
    </SheetFrame>
  );
}

function OpeningSheet({ open }: { open: boolean }) {
  const selection = usePlanStore((s) => s.selection);
  const plan = usePlanStore((s) => s.current());
  const opening =
    selection?.kind === "opening"
      ? plan.openings.find((o) => o.id === selection.id)
      : null;
  if (!open) return null;
  if (!opening) {
    return (
      <SheetFrame open={open} title="Opening">
        <p className="text-sm text-muted">Tap a window or door on the plan.</p>
      </SheetFrame>
    );
  }
  const configs = opening.type === "door" ? DOOR_CONFIGS : WINDOW_CONFIGS;
  return (
    <SheetFrame open={open} title={`${opening.type === "door" ? "Door" : "Window"} ${opening.mark}`}>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-muted">
            Width{opening.type === "window" ? " (in)" : ""}
          </label>
          <DimInput
            tone="paper"
            label={opening.type === "window" ? "Width in inches" : "Width"}
            valueFeet={opening.width}
            unit={openingUnit(opening.type)}
            className="mt-1 w-full rounded-xl"
            onCommit={(feet) => usePlanStore.getState().setOpeningWidth(opening.id, feet)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted">
            Height{opening.type === "window" ? " (in)" : ""}
          </label>
          <DimInput
            tone="paper"
            label={opening.type === "window" ? "Height in inches" : "Height"}
            valueFeet={opening.height}
            unit={openingUnit(opening.type)}
            autoFocus
            className="mt-1 w-full rounded-xl"
            onCommit={(feet) => usePlanStore.getState().setOpeningHeight(opening.id, feet)}
          />
        </div>
      </div>
      <label className="mt-3 block text-xs font-medium text-muted">Config</label>
      <div className="mt-1 flex flex-wrap gap-1">
        {configs.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => usePlanStore.getState().updateOpening(opening.id, { config: c })}
            className={cn(
              "h-9 rounded-full px-3 font-mono text-xs",
              opening.config === c ? "bg-ink text-paper" : "bg-paper-2 text-ink",
            )}
          >
            {c}
          </button>
        ))}
      </div>
      <label className="mt-3 block text-xs font-medium text-muted">Room</label>
      <div className="mt-1 flex flex-wrap gap-1">
        {roomChoices(plan.labels.map((l) => l.text)).map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => usePlanStore.getState().updateOpening(opening.id, { room: name })}
            className={cn(
              "h-9 rounded-full px-3 text-xs font-medium",
              opening.room === name ? "bg-ink text-paper" : "bg-paper-2 text-ink",
            )}
          >
            {name}
          </button>
        ))}
      </div>
      <label className="mt-3 block text-xs font-medium text-muted">Notes</label>
      <input
        value={opening.notes}
        onChange={(e) => usePlanStore.getState().updateOpening(opening.id, { notes: e.target.value })}
        placeholder="Egress, impact, mulled…"
        className="mt-1 h-11 w-full rounded-xl bg-paper-2 px-3 text-sm text-ink outline-none ring-1 ring-ink/10 focus:ring-2 focus:ring-accent"
      />
      <div className="mt-4 flex gap-2">
        <Button
          variant="outline"
          onClick={() => usePlanStore.getState().flipOpening(opening.id)}
        >
          <FlipHorizontal className="size-4" />
          Flip
        </Button>
        <Button
          variant="primary"
          className="flex-1"
          onClick={() => usePlanStore.getState().setSheet("none")}
        >
          Done
        </Button>
      </div>
    </SheetFrame>
  );
}

function SettingsSheet({ open }: { open: boolean }) {
  const showGrid = usePlanStore((s) => s.showGrid);
  const showDims = usePlanStore((s) => s.showDims);
  const pencilMode = usePlanStore((s) => s.pencilMode);
  const ortho = usePlanStore((s) => s.ortho);

  return (
    <SheetFrame open={open} title="Drawing">
      <ToggleRow
        icon={PenTool}
        label="Pencil mode"
        hint="Apple Pencil draws, finger pans"
        on={pencilMode}
        onChange={(v) => usePlanStore.getState().setPencilMode(v)}
      />
      <ToggleRow
        icon={Grid3x3}
        label="Right angles"
        hint="Snap walls to 90 degrees"
        on={ortho}
        onChange={(v) => usePlanStore.getState().setOrtho(v)}
      />
      <ToggleRow
        icon={Layers}
        label="Grid"
        hint="One square is one foot"
        on={showGrid}
        onChange={(v) => usePlanStore.getState().setShowGrid(v)}
      />
      <ToggleRow
        icon={Ruler}
        label="Dimensions"
        hint="Show lengths on walls"
        on={showDims}
        onChange={(v) => usePlanStore.getState().setShowDims(v)}
      />
      <Button
        variant="outline"
        className="mt-4 w-full"
        onClick={() => {
          usePlanStore.getState().clearPlan();
          usePlanStore.getState().setSheet("none");
        }}
      >
        Clear this plan
      </Button>
    </SheetFrame>
  );
}

function ToggleRow({
  icon: Icon,
  label,
  hint,
  on,
  onChange,
}: {
  icon: typeof Grid3x3;
  label: string;
  hint: string;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className="flex w-full items-center gap-3 rounded-2xl py-3 text-left"
    >
      <span className="flex size-10 items-center justify-center rounded-xl bg-paper-2">
        <Icon className="size-4" />
      </span>
      <span className="flex-1">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-muted">{hint}</span>
      </span>
      <span
        className={cn(
          "relative h-7 w-11 rounded-full transition-colors duration-150",
          on ? "bg-primary" : "bg-ink/15",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-6 rounded-full bg-paper transition-transform duration-150",
            on ? "translate-x-4" : "translate-x-0.5",
          )}
        />
      </span>
    </button>
  );
}

function roomChoices(placed: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of [...placed, ...ROOM_STAMPS]) {
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  return out;
}

function LabelSheet({ open }: { open: boolean }) {
  const draft = usePlanStore((s) => s.labelDraft);
  const pendingPoint = usePlanStore((s) => s.pendingPoint);
  return (
    <SheetFrame open={open} title="Custom room">
      <input
        autoFocus={open}
        value={draft}
        onChange={(e) => usePlanStore.getState().setLabelDraft(e.target.value)}
        placeholder="Pantry, Loft…"
        className="h-12 w-full rounded-xl bg-paper-2 px-3 text-base text-ink outline-none ring-1 ring-ink/10 focus:ring-2 focus:ring-accent"
        onKeyDown={(e) => {
          if (e.key === "Enter") submitLabel();
        }}
      />
      <div className="mt-4 flex gap-2">
        <Button variant="primary" className="flex-1" onClick={submitLabel}>
          {pendingPoint ? "Drop here" : "Use stamp"}
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            usePlanStore.getState().setPendingPoint(null);
            usePlanStore.getState().setSheet("none");
          }}
        >
          Cancel
        </Button>
      </div>
    </SheetFrame>
  );
}

function submitLabel() {
  const s = usePlanStore.getState();
  const name = s.labelDraft.trim();
  if (!name) return;
  if (s.pendingPoint) s.placeLabel(s.pendingPoint, name);
  else s.setPendingStamp(name);
  s.setPendingPoint(null);
  s.setSheet("none");
}

function JobGate() {
  const plans = usePlanStore((s) => s.plans);
  const orgJobs = usePlanStore((s) => s.orgJobs);
  const [job, setJob] = useState("");
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function openJob() {
    const n = job.trim();
    if (!n) return;
    setBusy(true);
    setNote("");
    try {
      const found = await lookupJob(n);
      const s = usePlanStore.getState();
      if (found.found) {
        if (found.plan) s.importPlan(found.plan);
        else {
          s.setJobMeta({
            jobNumber: found.jobNumber,
            address: found.address || address.trim(),
            name: `Job ${found.jobNumber}`,
          });
        }
        s.dismissWelcome();
        return;
      }
      setNote("No job with that number in this company.");
    } finally {
      setBusy(false);
    }
  }

  const recent = plans.filter((p) => p.jobNumber.trim());

  return (
    <div className="absolute inset-0 z-30 flex items-end justify-center bg-ink/35 p-4 safe-bottom-sheet sm:items-center">
      <div className="welcome-card w-full max-w-md rounded-2xl bg-paper p-7 text-ink shadow-[var(--shadow-sheet)]">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">
          PermitAIO · Assignment
        </p>
        <h1 className="font-heading mt-2 text-4xl leading-none tracking-tight text-balance">
          Measure Tech
        </h1>
        <p className="mt-4 text-pretty text-sm leading-relaxed text-muted">
          Job number is the source of truth. This sheet lands on the same job
          the office, warehouse, and install already use.
        </p>
        <label className="mt-6 block text-xs font-medium text-muted">Job number</label>
        <input
          value={job}
          autoFocus
          inputMode="numeric"
          autoCapitalize="off"
          autoCorrect="off"
          placeholder="1042"
          onChange={(e) => setJob(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") openJob();
          }}
          className="mt-1 h-12 w-full rounded-xl bg-paper-2 px-3 font-mono text-base text-ink outline-none ring-1 ring-ink/10 focus:ring-2 focus:ring-accent"
        />
        <label className="mt-3 block text-xs font-medium text-muted">Address</label>
        <input
          value={address}
          autoComplete="street-address"
          placeholder="Optional"
          onChange={(e) => setAddress(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") openJob();
          }}
          className="mt-1 h-12 w-full rounded-xl bg-paper-2 px-3 text-base text-ink outline-none ring-1 ring-ink/10 focus:ring-2 focus:ring-accent"
        />
        <Button
          variant="accent"
          className="mt-5 w-full"
          disabled={!job.trim() || busy}
          onClick={openJob}
        >
          {busy ? "Opening…" : "Open job"}
        </Button>
        {note ? <p className="mt-3 text-sm text-danger">{note}</p> : null}
        {orgJobs.length > 0 && (
          <ul className="mt-4 divide-y divide-ink/8">
            {orgJobs.slice(0, 6).map((p) => (
              <li key={p.jobNumber}>
                <button
                  type="button"
                  className="flex h-11 w-full items-center justify-between text-left text-sm"
                  onClick={async () => {
                    setJob(p.jobNumber);
                    setAddress(p.address);
                    setBusy(true);
                    setNote("");
                    try {
                      const found = await lookupJob(p.jobNumber);
                      const s = usePlanStore.getState();
                      if (found.found) {
                        if (found.plan) s.importPlan(found.plan);
                        else {
                          s.setJobMeta({
                            jobNumber: found.jobNumber,
                            address: found.address || p.address,
                            name: `Job ${found.jobNumber}`,
                          });
                        }
                        s.dismissWelcome();
                      }
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <span className="font-mono text-primary">Job {p.jobNumber}</span>
                  <span className="truncate text-muted">{p.address}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {orgJobs.length === 0 && recent.length > 0 && (
          <ul className="mt-4 divide-y divide-ink/8">
            {recent.slice(0, 4).map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="flex h-11 w-full items-center justify-between text-left text-sm"
                  onClick={() => {
                    const s = usePlanStore.getState();
                    s.switchPlan(p.id);
                    s.dismissWelcome();
                  }}
                >
                  <span className="font-mono text-primary">Job {p.jobNumber}</span>
                  <span className="truncate text-muted">{p.address || p.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
