import Image from "next/image";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Scan-to-join QR codes, one per join surface. "Team" covers permit tech,
 * HOA tech, manager, account manager, project manager, and installer — the
 * person picks their specific role after signing in, and an admin confirms
 * it in Pending join requests below. "Sales" is its own longstanding join
 * flow (code-only, immediate access, no approval step) — it just didn't
 * have a QR code before.
 */
export function TeamJoinQrCard({ hasCode }: { hasCode: boolean }) {
  if (!hasCode) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-base">Scan to join</CardTitle>
          <CardDescription>Set a join code above first — these QR codes need one to point to.</CardDescription>
        </CardHeader>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-base">Scan to join</CardTitle>
        <CardDescription>
          Hand someone your phone (or print these). Assigned-role QR: they enter a password — you already set the role. Team QR: they pick a role, you approve.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-6">
        <div className="space-y-2 text-center">
          <Image
            src="/api/join/join-qr"
            alt="QR code to join with assigned role"
            width={200}
            height={200}
            unoptimized
            className="rounded-lg border bg-white p-2"
          />
          <p className="text-xs font-medium text-muted-foreground">
            Assigned role
            <br />
            (they create a password)
          </p>
        </div>
        <div className="space-y-2 text-center">
          <Image
            src="/api/team/join-qr"
            alt="QR code to join the team"
            width={200}
            height={200}
            unoptimized
            className="rounded-lg border bg-white p-2"
          />
          <p className="text-xs font-medium text-muted-foreground">
            Team
            <br />
            (picks role after sign-in)
          </p>
        </div>
        <div className="space-y-2 text-center">
          <Image
            src="/api/sales/join-qr"
            alt="QR code to join Sales"
            width={200}
            height={200}
            unoptimized
            className="rounded-lg border bg-white p-2"
          />
          <p className="text-xs font-medium text-muted-foreground">Sales</p>
        </div>
      </CardContent>
    </Card>
  );
}
