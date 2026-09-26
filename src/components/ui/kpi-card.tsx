"use client";

import type { ComponentType, KeyboardEvent, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type KpiTone = "neutral" | "primary" | "danger" | "warn" | "good" | "info" | "accent";

const TONE_CLASSES: Record<KpiTone, string> = {
  neutral: "text-foreground",
  primary: "text-primary",
  danger: "text-red-600 dark:text-red-400",
  warn: "text-amber-600 dark:text-amber-400",
  good: "text-emerald-600 dark:text-emerald-400",
  info: "text-primary",
  accent: "text-violet-600 dark:text-violet-400",
};

const TONE_ICON: Record<KpiTone, string> = {
  neutral: "bg-primary text-primary-foreground",
  primary: "bg-primary text-primary-foreground",
  danger: "bg-red-600 text-white",
  warn: "bg-amber-500 text-white",
  good: "bg-emerald-600 text-white dark:bg-emerald-500",
  info: "bg-primary text-primary-foreground",
  accent: "bg-violet-600 text-white dark:bg-violet-500",
};

const TONE_ACTIVE: Record<KpiTone, string> = {
  neutral: "bg-primary/10",
  primary: "bg-primary/10",
  danger: "bg-red-600/10",
  warn: "bg-amber-500/10",
  good: "bg-emerald-600/10",
  info: "bg-primary/10",
  accent: "bg-violet-600/10",
};

type KpiCardProps = {
  label: string;
  value: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  tone?: KpiTone;
  onClick?: () => void;
  active?: boolean;
  className?: string;
  title?: string;
};

export function KpiCard({ label, value, icon: Icon, tone = "neutral", onClick, active, className, title }: KpiCardProps) {
  const isInteractive = !!onClick;

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!onClick) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClick();
    }
  }

  return (
    <div
      role={isInteractive ? "button" : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={isInteractive ? handleKeyDown : undefined}
      className={cn(
        "flex min-w-0 items-center gap-3 rounded-2xl px-3 py-3",
        isInteractive &&
          "cursor-pointer text-left hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        active ? TONE_ACTIVE[tone] : "",
        className,
      )}
    >
      <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full shadow-sm", TONE_ICON[tone])}>
        {Icon ? <Icon className="h-4 w-4" /> : <span className="h-2 w-2 rounded-full bg-current" />}
      </div>
      <div className="min-w-0 flex-1">
        <p
          className={cn("truncate text-lg font-semibold leading-tight tabular-nums sm:text-xl", TONE_CLASSES[tone])}
          title={title ?? (typeof value === "string" || typeof value === "number" ? String(value) : undefined)}
        >
          {value}
        </p>
        <p className="line-clamp-2 text-xs leading-snug text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
