import { addRunnerMember } from "@/app/(app)/runner/actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BTN_BLUE, FIELD, PILL } from "@/lib/ui/chrome";
import { FILL_GREEN } from "@/lib/ui/fills";

type Roster = { id: string; email: string; display_name?: string | null };

export function RunnerTeamCard({ roster }: { roster: Roster[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-base">Permit Runner</CardTitle>
        <CardDescription>
          Assign here first. They go to permitaio.com/join, enter the company code, and create a password.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {roster.length === 0 ? (
          <p className="text-sm text-muted-foreground">None yet</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {roster.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2">
                <span>{m.display_name?.trim() || m.email}</span>
                <span className={`${PILL} ${FILL_GREEN}`}>Runner</span>
              </li>
            ))}
          </ul>
        )}
        <form action={addRunnerMember} className="grid gap-3 border-t pt-4 sm:grid-cols-2">
          <input type="hidden" name="next" value="/settings" />
          <label className="text-xs sm:col-span-2">
            Email
            <input name="email" type="email" required className={FIELD} />
          </label>
          <label className="text-xs sm:col-span-2">
            Name
            <input name="displayName" className={FIELD} />
          </label>
          <button className={`${BTN_BLUE} sm:col-span-2`} type="submit">
            Add runner
          </button>
        </form>
      </CardContent>
    </Card>
  );
}
