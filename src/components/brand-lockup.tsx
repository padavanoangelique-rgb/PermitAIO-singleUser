import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";

/**
 * Primary brand lockup: mark + "PermitAIO" + "All in One Permitting" tagline,
 * stacked so it stays readable in narrow contexts (sidebar, auth card).
 */
export function BrandLockup({
  iconClassName = "h-7 w-7 text-primary",
  nameClassName = "font-heading text-lg font-semibold tracking-tight text-foreground",
  taglineClassName = "text-[10px] font-medium tracking-wide text-muted-foreground uppercase",
  align = "left",
  className,
}: {
  iconClassName?: string;
  nameClassName?: string;
  taglineClassName?: string;
  align?: "left" | "center";
  className?: string;
}) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <Logo className={cn(iconClassName, "shrink-0")} />
      <span
        className={cn(
          "flex flex-col leading-tight",
          align === "center" && "items-center",
        )}
      >
        <span className={nameClassName}>PermitAIO</span>
        <span className={taglineClassName}>All in One Permitting</span>
      </span>
    </span>
  );
}
