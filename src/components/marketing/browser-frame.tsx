import Image from "next/image";
import { cn } from "@/lib/utils";

interface BrowserFrameProps {
  src: string;
  alt: string;
  label?: string;
  className?: string;
  dark?: boolean;
  priority?: boolean;
  caption?: string;
  width: number;
  height: number;
}

export function BrowserFrame({
  src,
  alt,
  label = "app.permitaio.com",
  className,
  priority = false,
  caption,
  width,
  height,
}: BrowserFrameProps) {
  return (
    <figure className={cn("m-0", className)}>
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-lg shadow-black/5">
        <div className="flex items-center px-3 py-1.5">
          <span className="truncate text-[11px] text-muted-foreground">{label}</span>
        </div>
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          sizes="(min-width: 1024px) 960px, 100vw"
          className="h-auto w-full bg-muted/30"
          priority={priority}
        />
      </div>
      {caption ? (
        <figcaption className="mt-2 text-sm text-muted-foreground">{caption}</figcaption>
      ) : null}
    </figure>
  );
}