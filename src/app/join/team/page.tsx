import { Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { TeamSignUpForm, TeamCodeForm } from "./team-join-form";

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

export default async function TeamJoinPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; company?: string; code?: string }>;
}) {
  const { role, company, code } = await searchParams;
  const roleKey = role && ROLE_LABEL[role] ? role : "";
  const roleLabel = roleKey ? ROLE_LABEL[roleKey] : "the team";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center space-y-6 px-4 py-12">
      <div className="flex flex-col items-center gap-2 text-center">
        <Users className="h-8 w-8 text-primary" />
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Join as {roleLabel}</h1>
        <p className="text-sm text-muted-foreground">
          {company || code
            ? "Your company and join code came in from the QR code — just create your account (or sign in), then pick your role."
            : "Ask your manager for your company's name and 4-digit join code first — you'll need both."}
        </p>
      </div>
      {!user ? (
        <TeamSignUpForm role={roleKey} company={company ?? ""} code={code ?? ""} />
      ) : (
        <TeamCodeForm email={user.email ?? ""} role={roleKey} company={company ?? ""} code={code ?? ""} />
      )}
    </div>
  );
}
