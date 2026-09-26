import { HardHat } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { InstallSignUpForm, InstallCodeForm } from "./install-join-form";

export default async function InstallJoinPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string; code?: string }>;
}) {
  const { company, code } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center space-y-6 px-4 py-12">
      <div className="flex flex-col items-center gap-2 text-center">
        <HardHat className="h-8 w-8 text-primary" />
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Join your install team</h1>
        <p className="text-sm text-muted-foreground">
          {company || code
            ? "Your company and join code came in from the QR code — just create your account (or sign in)."
            : "Ask your Install Manager for your company's name and 4-digit join code first — you'll need both."}
        </p>
      </div>
      {!user ? (
        <InstallSignUpForm company={company ?? ""} code={code ?? ""} />
      ) : (
        <InstallCodeForm email={user.email ?? ""} company={company ?? ""} code={code ?? ""} />
      )}
    </div>
  );
}
