import { approveRoleJoinRequest, denyRoleJoinRequest } from "@/lib/actions/join-org";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type PendingRequest = {
  id: string;
  user_id: string;
  email: string;
  requested_role: string;
  created_at: string;
};

const ROLE_LABEL: Record<string, string> = {
  permit_tech: "Permit Tech",
  hoa_tech: "HOA Tech",
  manager: "Manager",
  account_manager: "Account Manager",
  project_manager: "Project Manager",
  installer: "Installer",
  runner: "Permit Runner",
  service_tech: "Service Tech",
};

const FIELD = "h-10 rounded-full border border-input bg-background px-3 text-sm text-foreground";

export function PendingRoleRequestsCard({
  requests,
  permitTechSlots,
  hoaTechSlots,
}: {
  requests: PendingRequest[];
  permitTechSlots: string[];
  hoaTechSlots: string[];
}) {
  if (requests.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-base">Pending join requests</CardTitle>
        <CardDescription>
          People who scanned the join QR code, signed in, and picked their role — approve to confirm it.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {requests.map((r) => {
          const isTech = r.requested_role === "permit_tech" || r.requested_role === "hoa_tech";
          const slots = r.requested_role === "permit_tech" ? permitTechSlots : hoaTechSlots;
          return (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl px-3 py-2 hover:bg-muted/40">
              <div>
                <p className="text-sm font-medium">{r.email}</p>
                <p className="text-xs text-muted-foreground">Wants to join as {ROLE_LABEL[r.requested_role] ?? r.requested_role}</p>
              </div>
              <div className="flex items-center gap-2">
                <form action={approveRoleJoinRequest} className="flex items-center gap-2">
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="userId" value={r.user_id} />
                  <input type="hidden" name="requestedRole" value={r.requested_role} />
                  <input type="hidden" name="email" value={r.email} />
                  {isTech ? (
                    <select name="slot" required defaultValue="" className={FIELD}>
                      <option value="" disabled>
                        Pick a slot
                      </option>
                      {slots.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  ) : null}
                  <Button type="submit" size="sm">Approve</Button>
                </form>
                <form action={denyRoleJoinRequest}>
                  <input type="hidden" name="id" value={r.id} />
                  <Button type="submit" size="sm" variant="ghost">Deny</Button>
                </form>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
