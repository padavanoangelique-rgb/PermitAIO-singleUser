import { Briefcase } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SalesSignUpForm, SalesCodeForm } from "./sales-join-form";

export default async function SalesJoinPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center space-y-6 px-4 py-12">
      <div className="flex flex-col items-center gap-2 text-center">
        <Briefcase className="h-8 w-8 text-primary" />
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Sales team sign-up</h1>
        <p className="text-sm text-muted-foreground">
          {code
            ? "Your company's join code came in from the QR code — just create your account (or sign in)."
            : "Ask your manager for your company's 4-digit join code."}
        </p>
      </div>
      {!user ? <SalesSignUpForm code={code ?? ""} /> : <SalesCodeForm email={user.email ?? ""} code={code ?? ""} />}
    </div>
  );
}
