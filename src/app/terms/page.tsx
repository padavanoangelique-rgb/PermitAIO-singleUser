import Link from "next/link";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { LEGAL_LAST_UPDATED } from "@/lib/marketing/legal-updated";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "The terms that govern access to and use of PermitAIO, the permitting platform for windows and roofing contractors.",
};

export default function TermsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="flex-1 px-6 py-16 md:px-10 md:py-24">
        <div className="mx-auto max-w-3xl">
          <p className="text-sm font-medium text-primary">Legal</p>
          <h1 className="mt-2 font-heading text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            Terms of Service
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Last updated {LEGAL_LAST_UPDATED}
          </p>

          <div className="prose-legal mt-10 space-y-8 text-sm leading-relaxed text-foreground/90 md:text-base">
            <section>
              <h2 className="text-lg font-semibold text-foreground">
                1. Agreement to terms
              </h2>
              <p className="mt-2 text-muted-foreground">
                These Terms of Service (&ldquo;Terms&rdquo;) govern access to
                and use of PermitAIO (&ldquo;PermitAIO,&rdquo;
                &ldquo;we,&rdquo; &ldquo;us&rdquo;), including the website at
                permitaio.com and the associated web application
                (collectively, the &ldquo;Service&rdquo;). By creating an
                account or otherwise using the Service, you agree to be
                bound by these Terms on behalf of yourself and, if
                applicable, the business you represent (&ldquo;you&rdquo;
                or &ldquo;your organization&rdquo;). If you do not agree,
                do not use the Service.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">
                2. The Service
              </h2>
              <p className="mt-2 text-muted-foreground">
                PermitAIO is a multi-tenant software platform for windows
                and roofing contractors that unifies floor plan creation,
                permit inventory tracking, HOA requirement tracking, county
                forms generation, and NOA (Notice of Acceptance) matching
                under a single Job number. Each organization&apos;s data is
                logically isolated from every other organization on the
                Service.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">
                3. Accounts and organizations
              </h2>
              <p className="mt-2 text-muted-foreground">
                You must provide accurate information when creating an
                account and are responsible for maintaining the
                confidentiality of your login credentials and for all
                activity that occurs under your account. The person who
                creates an organization on PermitAIO is its Owner and can
                invite Admins and Members, assign roles, and manage
                billing. You are responsible for the actions of everyone
                you invite into your organization.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">
                4. Subscriptions, fees, and billing
              </h2>
              <p className="mt-2 text-muted-foreground">
                Paid plans are billed in advance on a recurring basis as
                described on the{" "}
                <Link
                  href="/pricing"
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  pricing page
                </Link>
                . A one-time onboarding fee applies to new organizations as
                described at signup. You can upgrade, downgrade, or cancel
                a subscription at any time from Settings; changes to
                recurring fees take effect at your next billing cycle, and
                the one-time onboarding fee is not repeated when you change
                plans. Except where required by law, fees are
                non-refundable.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">
                5. Your data
              </h2>
              <p className="mt-2 text-muted-foreground">
                You retain all rights to the job data, floor plans,
                documents, and other content you or your organization
                upload to the Service (&ldquo;Customer Data&rdquo;). You
                grant PermitAIO a limited license to host, process, and
                display Customer Data solely to provide and improve the
                Service. See our{" "}
                <Link
                  href="/privacy"
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  Privacy Policy
                </Link>{" "}
                for how we handle personal information.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">
                6. Acceptable use
              </h2>
              <p className="mt-2 text-muted-foreground">
                You agree not to: use the Service for any unlawful purpose;
                attempt to access another organization&apos;s data without
                authorization; reverse engineer, resell, or sublicense the
                Service; upload malicious code; or interfere with the
                Service&apos;s normal operation.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">
                7. Jurisdiction forms and permit accuracy
              </h2>
              <p className="mt-2 text-muted-foreground">
                PermitAIO helps generate and organize jurisdiction forms,
                NOA packages, and permit documentation based on information
                you provide. You remain solely responsible for verifying
                the accuracy and completeness of any submission made to a
                county, municipality, HOA, or other authority. PermitAIO
                does not guarantee permit approval and is not a substitute
                for licensed professional judgment.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">
                8. Service availability
              </h2>
              <p className="mt-2 text-muted-foreground">
                We aim to keep the Service available at all times but do
                not guarantee uninterrupted access. We may perform
                scheduled maintenance or make changes to features from
                time to time.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">
                9. Termination
              </h2>
              <p className="mt-2 text-muted-foreground">
                You may cancel your subscription at any time. We may
                suspend or terminate access to the Service if these Terms
                are violated or if fees are not paid when due. Upon
                termination, we will retain Customer Data for a reasonable
                period to allow export, after which it may be deleted.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">
                10. Disclaimers and limitation of liability
              </h2>
              <p className="mt-2 text-muted-foreground">
                The Service is provided &ldquo;as is&rdquo; without
                warranties of any kind. To the maximum extent permitted by
                law, PermitAIO will not be liable for any indirect,
                incidental, or consequential damages arising from use of
                the Service.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">
                11. Changes to these Terms
              </h2>
              <p className="mt-2 text-muted-foreground">
                We may update these Terms from time to time. Material
                changes will be reflected by updating the date at the top
                of this page. Continued use of the Service after changes
                take effect constitutes acceptance of the revised Terms.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">
                12. Contact
              </h2>
              <p className="mt-2 text-muted-foreground">
                Questions about these Terms can be sent to{" "}
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
