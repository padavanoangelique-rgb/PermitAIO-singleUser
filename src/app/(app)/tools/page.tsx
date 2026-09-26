import Link from "next/link";
import { requireActiveOrg } from "@/lib/data/orgs";
import { FIELD_TOOLS } from "@/lib/field-tools";
import { FILL_BLUE, FILL_GREEN, FILL_PURPLE } from "@/lib/ui/fills";

export default async function ToolsPage() {
  await requireActiveOrg();

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Field calculators</p>
        <h1 className="mt-1 font-heading text-2xl font-semibold tracking-tight">Tools</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Same field calculators as Permit Toolkit, inside the job workspace. Highest value first.
          No ads. No email wall.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {FIELD_TOOLS.map((t, i) => (
          <Link
            key={t.slug}
            href={`/tools/${t.slug}`}
            className="rounded-2xl px-4 py-4 transition-colors hover:bg-muted/40"
          >
            <div className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground">
              {String(i + 1).padStart(2, "0")}
            </div>
            <div className="mt-1 font-heading text-base font-semibold">{t.title}</div>
            <p className="mt-1 text-sm text-muted-foreground">{t.blurb}</p>
            <div className={`mt-3 inline-flex h-8 items-center rounded-full px-3 text-sm font-semibold ${i % 3 === 0 ? FILL_PURPLE : i % 3 === 1 ? FILL_BLUE : FILL_GREEN}`}>
              Open
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
