import Link from "next/link";
import { Check, ClipboardList, Home, MapPin, Search } from "lucide-react";
import { Logo } from "@/components/logo";
import { FILL_BLUE } from "@/lib/ui/fills";

const TAP =
  "inline-flex h-11 items-center justify-center gap-1.5 rounded-full px-5 text-sm font-semibold shadow-sm";

const STAGES = [
  { kicker: "Intake", title: "Ready to file", meta: "12 applications in queue", width: "w-3/5" },
  { kicker: "Review", title: "Plan check", meta: "8 packages with comments", width: "w-2/5" },
  { kicker: "Issued", title: "Permits live", meta: "31 active this week", width: "w-4/5" },
] as const;

export function WorkspaceHero({ showCtas = true }: { showCtas?: boolean }) {
  return (
    <section className="bg-paper px-3 pb-8 pt-4 sm:px-6 md:px-10 md:pt-6">
      <div className="mx-auto max-w-6xl overflow-hidden rounded-3xl border border-border bg-chrome shadow-sm">
        <div className="flex min-h-[28rem] md:min-h-[36rem]">
          <aside className="hidden w-16 shrink-0 flex-col items-center bg-primary py-5 text-primary-foreground md:flex">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-chrome/15">
              <Logo className="h-5 w-5" />
            </span>
            <nav className="mt-8 flex flex-1 flex-col items-center gap-5 text-primary-foreground/80">
              <Home className="h-5 w-5" aria-hidden />
              <ClipboardList className="h-5 w-5 text-chrome" aria-hidden />
              <MapPin className="h-5 w-5" aria-hidden />
              <Check className="h-5 w-5" aria-hidden />
            </nav>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-chrome/15 text-[10px] font-semibold tracking-wide">
              PA
            </span>
          </aside>

          <div className="relative flex min-w-0 flex-1 flex-col bg-gradient-to-b from-chrome to-paper-2 px-4 py-4 sm:px-8 sm:py-6">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-ink-soft">
                Workspace <span className="text-faint">·</span> Permit desk
              </p>
              <Link
                href="/login"
                className="flex h-9 max-w-56 flex-1 items-center gap-2 rounded-full border border-border bg-chrome px-3 text-sm text-faint sm:flex-none"
              >
                <Search className="h-4 w-4 shrink-0" aria-hidden />
                Search permits
              </Link>
            </div>

            <div className="flex flex-1 flex-col items-center justify-center py-10 text-center sm:py-14">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm sm:h-20 sm:w-20 sm:rounded-3xl">
                <Logo className="h-9 w-9 sm:h-11 sm:w-11" />
              </div>
              <h1 className="mt-5 font-heading text-4xl font-semibold tracking-tight text-balance text-ink sm:text-5xl md:text-6xl">
                PermitAIO
              </h1>
              <p className="mt-3 max-w-xl text-base leading-relaxed text-ink-soft sm:text-lg">
                The permit operating system for South Florida window, door, and roofing contractors.
                One job number from measure to inspection — permit, HOA, warehouse, and install on the same record.
                The more you use it, the more it knows your cities.
              </p>
            </div>

            <div className="grid gap-3 pb-2 sm:grid-cols-3">
              {STAGES.map((s) => (
                <article key={s.kicker} className="rounded-2xl border border-border bg-chrome px-4 py-4 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">{s.kicker}</p>
                  <p className="mt-1 font-heading text-lg font-semibold tracking-tight text-ink">{s.title}</p>
                  <p className="mt-1 text-sm text-ink-soft">{s.meta}</p>
                  <div className="mt-4 h-1 overflow-hidden rounded-full bg-primary/15">
                    <div className={`h-full rounded-full bg-primary ${s.width}`} />
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </div>

      {showCtas ? (
        <div className="mx-auto mt-8 flex max-w-6xl flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/signup" className={`${TAP} ${FILL_BLUE} w-full max-w-xs sm:w-auto`}>
            Start free trial
          </Link>
          <Link href="/join" className={`${TAP} w-full max-w-xs border border-border bg-chrome text-ink sm:w-auto`}>
            Join your company
          </Link>
          <Link href="/login" className={`${TAP} w-full max-w-xs border border-border bg-chrome text-ink sm:w-auto`}>
            Sign in
          </Link>
        </div>
      ) : null}
    </section>
  );
}
