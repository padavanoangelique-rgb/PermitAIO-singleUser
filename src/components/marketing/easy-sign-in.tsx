import Link from "next/link";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { WorkspaceHero } from "@/components/marketing/workspace-hero";
import { AssignedJoinForm } from "@/app/join/assigned-join-form";

const STEPS = [
  "Your manager already assigned your role. Use the same email they put in Settings.",
  "Type the company name and the 4-digit company code.",
  "Type your work email. Create your own password (8+ characters).",
  "You’re in. You do not pick a role — it’s already set.",
];

export function EasySignIn({ company = "", code = "" }: { company?: string; code?: string }) {
  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <SiteHeader />
      <main className="flex-1">
        <WorkspaceHero />

        <section className="px-4 py-10 sm:px-6 md:px-10 md:py-16">
          <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-faint">New — first time only</p>
              <h2 className="mt-2 font-heading text-2xl font-semibold tracking-tight text-ink">Easy sign-in</h2>
              <ol className="mt-6 space-y-4">
                {STEPS.map((step, i) => (
                  <li key={step} className="flex gap-3">
                    <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                      {i + 1}
                    </span>
                    <p className="pt-0.5 text-base leading-relaxed text-pretty text-ink-soft">{step}</p>
                  </li>
                ))}
              </ol>

              <div className="mt-8 rounded-2xl border border-border bg-chrome px-5 py-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-faint">Every day after that</p>
                <p className="mt-2 font-heading text-2xl font-semibold tracking-tight text-ink">permitaio.com/login</p>
                <p className="mt-1 text-sm text-ink-soft">Same email. The password you created. Do not share it.</p>
                <Link
                  href="/login"
                  className="mt-4 inline-flex h-10 items-center rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground"
                >
                  Sign in
                </Link>
              </div>

              <p className="mt-6 text-sm text-ink-soft">
                Forgot it? Use Forgot password on the login page — the reset goes to your email.
              </p>
              <p className="mt-4 text-sm text-ink-soft">
                New company, not joining a team?{" "}
                <Link href="/signup" className="font-semibold text-ink underline-offset-4 hover:underline">
                  Start a trial
                </Link>
                {" · "}
                <Link href="/" className="font-semibold text-ink underline-offset-4 hover:underline">
                  See the product
                </Link>
              </p>
            </div>

            <AssignedJoinForm company={company} code={code} />
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
