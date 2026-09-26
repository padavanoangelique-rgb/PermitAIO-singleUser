import type { Metadata } from "next";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { LEGAL_LAST_UPDATED } from "@/lib/marketing/legal-updated";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How PermitAIO collects, uses, and protects information for contractors and their teams.",
};

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="flex-1 px-6 py-16 md:px-10 md:py-24">
        <div className="mx-auto max-w-3xl">
          <p className="text-sm font-medium text-primary">Legal</p>
          <h1 className="mt-2 font-heading text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            Privacy Policy
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Last updated {LEGAL_LAST_UPDATED}
          </p>

          <div className="mt-10 space-y-8 text-sm leading-relaxed text-foreground/90 md:text-base">
            <section>
              <h2 className="text-lg font-semibold text-foreground">
                1. Overview
              </h2>
              <p className="mt-2 text-muted-foreground">
                This Privacy Policy explains what information PermitAIO
                collects when you use permitaio.com and the PermitAIO web
                application (the &ldquo;Service&rdquo;), how we use it,
                and the choices you have. It applies to contractor teams,
                their employees, and visitors to our marketing site.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">
                2. Information we collect
              </h2>
              <ul className="mt-2 list-disc space-y-2 pl-5 text-muted-foreground">
                <li>
                  <span className="font-medium text-foreground">
                    Account information
                  </span>{" "}
                  — name, work email, password (stored as a salted hash),
                  organization name, and role.
                </li>
                <li>
                  <span className="font-medium text-foreground">
                    Job and business data
                  </span>{" "}
                  — job numbers, client names and addresses, floor plans,
                  window and door schedules, permit and inventory records,
                  HOA requirements, and documents your organization uploads
                  or generates through the Service.
                </li>
                <li>
                  <span className="font-medium text-foreground">
                    Usage data
                  </span>{" "}
                  — pages visited, features used, device and browser type,
                  and approximate location inferred from IP address, used
                  to keep the Service secure and to understand how it&apos;s
                  used.
                </li>
                <li>
                  <span className="font-medium text-foreground">
                    Cookies
                  </span>{" "}
                  — used to keep you signed in and remember preferences
                  such as light/dark mode. We do not use third-party
                  advertising cookies.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">
                3. How we use information
              </h2>
              <p className="mt-2 text-muted-foreground">
                We use collected information to: provide and maintain the
                Service; authenticate accounts and enforce organization-level
                access controls; generate permit packages, forms, and
                reports you request; provide customer support; monitor for
                security issues and abuse; and improve the Service. We do
                not sell personal information.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">
                4. How information is stored and protected
              </h2>
              <p className="mt-2 text-muted-foreground">
                Job and account data is stored with our database and
                authentication provider, Supabase, using row-level security
                policies that keep each organization&apos;s data isolated
                from every other organization. The application is hosted
                on Vercel. Data is encrypted in transit via HTTPS.
                Passwords are never stored in plain text.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">
                5. Who can see your organization&apos;s data
              </h2>
              <p className="mt-2 text-muted-foreground">
                Job data, floor plans, permit records, and documents you
                create are visible only to members of your organization,
                scoped by the role your organization&apos;s Owner or Admin
                assigns (Owner, Admin, or Member). PermitAIO staff may
                access data only to provide support you request or to
                investigate a security or technical issue, and never to
                use it for marketing to your customers.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">
                6. Data sharing
              </h2>
              <p className="mt-2 text-muted-foreground">
                We share information only with service providers that help
                us operate the Service (such as our hosting and database
                providers), and only to the extent needed for them to
                perform that function. We may disclose information if
                required by law or to protect the rights, property, or
                safety of PermitAIO, our customers, or others.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">
                7. Data retention
              </h2>
              <p className="mt-2 text-muted-foreground">
                We retain account and job data for as long as your
                organization has an active subscription, plus a reasonable
                period afterward to allow data export or reactivation. You
                can request deletion of your organization&apos;s data by
                contacting us.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">
                8. Your choices
              </h2>
              <p className="mt-2 text-muted-foreground">
                You can review and update your account information from
                Settings at any time. Organization Owners can export or
                request deletion of their organization&apos;s data by
                contacting us at the email below.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">
                9. Changes to this policy
              </h2>
              <p className="mt-2 text-muted-foreground">
                We may update this Privacy Policy from time to time.
                Material changes will be reflected by updating the date at
                the top of this page.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">
                10. Contact
              </h2>
              <p className="mt-2 text-muted-foreground">
                Questions about this Privacy Policy or your data can be
                sent to{" "}
                <a
                  href="mailto:support@permitaio.com"
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  support@permitaio.com
                </a>
                .
              </p>
            </section>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
