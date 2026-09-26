import { cn } from "@/lib/utils";

export function ProductVideo({
  src,
  poster,
  className,
}: {
  src: string;
  poster?: string;
  className?: string;
}) {
  return (
    <div className={cn("overflow-hidden rounded-2xl border border-border bg-card shadow-lg shadow-black/5", className)}>
      <div className="flex items-center px-3 py-1.5">
        <span className="truncate text-[11px] text-muted-foreground">app.permitaio.com</span>
      </div>
      <video
        className="aspect-video w-full bg-muted"
        autoPlay
        muted
        loop
        playsInline
        controls
        poster={poster}
        preload="metadata"
      >
        <source src={src} type="video/mp4" />
      </video>
    </div>
  );
}