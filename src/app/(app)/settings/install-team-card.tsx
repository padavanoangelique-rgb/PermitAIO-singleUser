import { addInstallMember } from "@/app/(app)/install/actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RemoveInstallMemberButton } from "./remove-install-member-button";
import { BTN_BLUE, FIELD, PILL } from "@/lib/ui/chrome";
import { FILL_BLUE, FILL_GREEN, FILL_PURPLE } from "@/lib/ui/fills";

type Roster = {
  id: string;
  email: string;
  role: string;
  display_name?: string | null;
};

const ROLE_LABEL: Record<string, string> = {
  account_manager: "Account manager",
  project_manager: "Project manager",
  installer: "Installer",
};

const ROLE_TONE: Record<string, string> = {
  account_manager: FILL_PURPLE,
  project_manager: FILL_BLUE,
  installer: FILL_GREEN,
};

export function InstallTeamCard({ roster }: { roster: Roster[] }) {
  const byRole = (role: string) => roster.filter((m) => m.role === role);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-base">Install team</CardTitle>
        <CardDescription>
          Account managers, project managers, and installers. After you add them they go to permitaio.com/join and create a password.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {(["account_manager", "project_manager", "installer"] as const).map((role) => (
          <div key={role}>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{ROLE_LABEL[role]}</p>
            {byRole(role).length === 0 ? (
              <p className="mt-1 text-sm text-muted-foreground">None yet</p>
            ) : (
              <ul className="mt-1 space-y-1 text-sm">
                {byRole(role).map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-2">
                    <span>{m.display_name?.trim() || m.email}</span>
                    <div className="flex items-center gap-2">
                      <span className={`${PILL} ${ROLE_TONE[role]}`}>{ROLE_LABEL[role]}</span>
                      <RemoveInstallMemberButton id={m.id} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
        <form action={addInstallMember} className="grid gap-3 border-t pt-4 sm:grid-cols-2">
          <input type="hidden" name="next" value="/settings" />
          <label className="text-xs sm:col-span-2">
            Email
            <input name="email" type="email" required className={FIELD} />
          </label>
          <label className="text-xs">
            Role
            <select name="role" className={FIELD} defaultValue="installer">
              <option value="account_manager">Account manager</option>
              <option value="project_manager">Project manager</option>
              <option value="installer">Installer</option>
            </select>
          </label>
          <label className="text-xs">
            Name
            <input name="displayName" className={FIELD} />
          </label>
          <button className={`${BTN_BLUE} sm:col-span-2`} type="submit">
            Add to install team
          </button>
        </form>
      </CardContent>
    </Card>
  );
}
