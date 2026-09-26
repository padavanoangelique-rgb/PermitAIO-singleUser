import Link from "next/link";
import { FILL_BLUE, FILL_GREEN } from "@/lib/ui/fills";
import { PILL } from "@/lib/ui/chrome";

const TONES = [FILL_BLUE, FILL_GREEN];

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
        <p className="mt-1 text-sm text-muted-foreground">Pick Service Dashboard or the Service Tech app.</p>
      </header>
      {mail ? <p className="text-center text-sm text-emerald-700">{mail}</p> : null}
      <div className="flex flex-col items-center gap-2">
        {options.map((opt, i) => (
          <Link key={opt.key} href={`/service?app=${opt.key}`} className={`${PILL} h-11 px-6 ${TONES[i % TONES.length]}`}>
            {opt.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
