"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";

export function ToolFrame({
  title,
  src,
}: {
  title: string;
  src: string;
}) {
  const [full, setFull] = useState(false);

  const exit = useCallback(() => setFull(false), []);

  useEffect(() => {
    if (!full) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") exit();
    }
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [full, exit]);

  const iframe = (
    <iframe
      title={title}
      src={src}
      className="h-full w-full border-0 bg-background"
    />
  );

  const bar = (
    <div className="flex h-9 shrink-0 items-center gap-2 border-b bg-background px-3 text-sm">
      {!full ? (
        <>
          <Link href="/tools" className="text-muted-foreground hover:text-foreground">
            Tools
          </Link>
          <span className="text-muted-foreground">/</span>
        </>
      ) : null}
      <span className="min-w-0 flex-1 truncate font-medium">{title}</span>
      <button
        type="button"
        onClick={() => setFull((v) => !v)}
        className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-foreground hover:bg-muted"
      >
        {full ? (
          <>
            <Minimize2 className="h-3.5 w-3.5" />
            Exit full page
          </>
        ) : (
          <>
            <Maximize2 className="h-3.5 w-3.5" />
            Full page
          </>
        )}
      </button>
    </div>
  );

  if (full) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-background">
        {bar}
        <div className="min-h-0 flex-1">{iframe}</div>
      </div>
    );
  }

  return (
    <div className="-m-6 flex h-[calc(100%+3rem)] min-h-0 flex-col">
      {bar}
      <div className="min-h-0 flex-1">{iframe}</div>
    </div>
  );
}
