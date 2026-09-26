import Image from "next/image";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Pairs with JoinCodeCard: that one shows the raw name+code for someone to
 * type; this one turns the exact same pair into a QR code so a new
 * install-team hire can just scan it with their phone's camera app and
 * land on /join/install with both fields already filled in.
 */
export function InstallJoinQrCard({ hasCode }: { hasCode: boolean }) {
  if (!hasCode) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-base">Scan to join the install team</CardTitle>
          <CardDescription>Set a join code above first — the QR code needs one to point to.</CardDescription>
        </CardHeader>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-base">Scan to join the install team</CardTitle>
        <CardDescription>
          Hand a new account manager, project manager, or installer your phone (or print this) — scanning it opens
          the sign-up page with your company name and join code already filled in, so all they type is their own
          email and password.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Image
          src="/api/install/join-qr"
          alt="QR code to join the install team"
          width={220}
          height={220}
          unoptimized
          className="rounded-lg border bg-white p-3"
        />
      </CardContent>
    </Card>
  );
}
