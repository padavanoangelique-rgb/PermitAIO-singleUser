import { addServiceMember } from "@/app/(app)/service/actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RemoveServiceMemberButton } from "./remove-service-member-button";
import { BTN_BLUE, FIELD, PILL } from "@/lib/ui/chrome";
import { FILL_GREEN } from "@/lib/ui/fills";

type Roster = {
  id: string;
  email: string;
  role: string;
  display_name?: string | null;
};

export function ServiceTeamCard({ roster }: { roster: Roster[] }) {
  const techs = roster.filter((m) => m.role === "service_tech");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-base">Service team</CardTitle>
        <CardDescription>
          Service techs. After you add them they go to permitaio.com/join and create a password. You assign jobs on the Service board.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Service tech</p>
          {techs.length === 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">None yet</p>
          ) : (
            <ul className="mt-1 space-y-1 text-sm">
              {techs.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2">
                  <span>{m.display_name?.trim() || m.email}</span>
                  <div className="flex items-center gap-2">
                    <span className={`${PILL} ${FILL_GREEN}`}>Service tech</span>
                    <RemoveServiceMemberButton id={m.id} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <form action={addServiceMember} className="grid gap-3 border-t pt-4 sm:grid-cols-2">
          <input type="hidden" name="next" value="/settings" />
          <input type="hidden" name="role" value="service_tech" />
          <label className="text-xs sm:col-span-2">
            Email
            <input name="email" type="email" required className={FIELD} />
          </label>
          <label className="text-xs sm:col-span-2">
            Name
            <input name="displayName" className={FIELD} />
          </label>
          <button className={`${BTN_BLUE} sm:col-span-2`} type="submit">
            Add service tech
          </button>
        </form>
      </CardContent>
    </Card>
  );
}
