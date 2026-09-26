import Link from "next/link";
import { FILL_BLUE, FILL_GREEN, FILL_PURPLE } from "@/lib/ui/fills";
import { PILL } from "./install-ui";

const TONES = [FILL_PURPLE, FILL_BLUE, FILL_GREEN];

export function RolePicker({
  options,
  mail,
}: {
  options: { key: string; label: string }[];
  mail?: string;
}) {
  return (
    <div className="mx-auto max-w-md space-y-5 py-10">
      <header className="text-center">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Continue as</h1>
        <p className="mt-1 text-sm text-muted-foreground">You have more than one role here. Pick which view to open.</p>
      </header>
      {mail ? <p className="text-center text-sm text-emerald-700">{mail}</p> : null}
      <div className="flex flex-col items-center gap-2">
        {options.map((opt, i) => (
          <Link key={opt.key} href={`/install?app=${opt.key}`} className={`${PILL} h-11 px-6 ${TONES[i % TONES.length]}`}>
            {opt.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
