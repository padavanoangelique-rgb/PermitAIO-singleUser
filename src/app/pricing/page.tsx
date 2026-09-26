import type { Metadata } from "next";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { PricingCards, SoloOwnerCard } from "@/components/marketing/pricing-cards";
import { ContactForm } from "@/components/marketing/contact-form";
import {
  comparisonRows,
  emailAssistantAddOn,
  extrasSummary,
  homeownerLinkDescription,
  homeownerLinkTiers,
  notIncludedFootnote,
  notIncludedList,
  subscriptionTiers,
} from "@/lib/marketing/pricing";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "PermitAIO pricing plans for windows and roofing contractors — Essential, Priority, and Concierge. One price per team. Unlimited packages. Onboarding is bundled into every plan.",
};

const faqs = [
  {
    question: "Do I pay online?",
    answer:
      "No. Pick a plan and send us a note — Angelique reads every lead and replies personally to schedule a short call. Once we confirm the plan and onboarding fit, we send a payment link directly to you. No self-serve checkout.",
  },
  {
    question: "Is onboarding a separate purchase?",
    answer:
      "No. Onboarding is bundled with the plan you pick — Essential is $1,500, Priority is $2,900, Concierge is $4,400 — and it's a one-time fee paid alongside the first month. It is not a menu you choose from separately.",
  },
  {
    question: "What are the seats and data caps for?",
    answer:
      "Seats set how many people from your team can log in. The first data load is how many jobs and HOAs we import from your CRM at onboarding. Both are hard caps for the plan; extras are $39/month per user and $249 per +100 jobs or +50 HOAs.",
  },
  {
    question: "Which counties does PermitAIO support?",
    answer:
      "Broward, Miami-Dade, and Palm Beach counties are fully supported today, with jurisdiction detection mapped to each county's folio numbering system.",
  },
  {
    question: "Can I change plans later?",
    answer:
      "Yes. Reach out and we'll switch you up or down. Your jobs, forms, and HOA data stay exactly where they are. The onboarding fee is a one-time charge and isn't repeated when you change plans.",
  },
  {
    question: "Do you run our permits for us?",
    answer:
      "No. PermitAIO is software — it builds the packages. We do not fix stuck permits, call the city, or work your jobs. The Permit Email Assistant is an automated report; we do not touch the job.",
  },
  {
    question: "How do team members work?",
    answer:
      "Essential includes 3 users, Priority 8, and Concierge 15. Every login is a real seat with role controls (manager or tech). Additional users are $39/month each on any plan.",
  },
  {
    question: "What happens to my data if I cancel?",
    answer:
      "Your jobs, floor plans, forms, and HOA records remain exportable for 30 days after cancellation. Email Hello@Permitaio.com and we'll help you get a full export.",
  },
];

export default function PricingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="flex-1">
        <section className="px-6 pt-20 pb-16 text-center md:px-10 md:pt-28">
          <div className="mx-auto max-w-2xl">
            <h1 className="font-heading text-4xl font-semibold tracking-tight md:text-5xl">
              Choose your monthly plan
            </h1>
            <p className="mt-4 text-muted-foreground md:text-lg">
              One price per team. Unlimited packages. Onboarding is included with
              the plan you pick — not a separate menu.
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              Seats and the first data load set the price. The software builds
              the packages. We do not work your jobs.
            </p>
          </div>
        </section>

        <section className="px-6 pb-24 md:px-10">
          <div className="mx-auto max-w-6xl">
            <div className="mt-2">
              <PricingCards />
            </div>
            <p className="mx-auto mt-6 max-w-2xl text-center text-xs text-muted-foreground">
              {extrasSummary.extraUser} · {extrasSummary.extraData} ·{" "}
              {extrasSummary.annual}
            </p>
          </div>
        </section>

        {/* Solo Owner */}
        <section className="border-t border-border/60 px-6 py-24 md:px-10">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-center font-heading text-3xl font-semibold tracking-tight md:text-4xl">
              Just you? Solo Owner covers it.
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-center text-sm text-muted-foreground">
              Every feature, one seat — no team to manage, no roles to assign.
            </p>
            <div className="mx-auto mt-12 max-w-md">
              <SoloOwnerCard />
            </div>
          </div>
        </section>

        {/* Add-ons */}
        <section className="border-t border-border/60 bg-secondary/30 px-6 py-24 md:px-10">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-center font-heading text-3xl font-semibold tracking-tight md:text-4xl">
              Add-ons — any plan
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-center text-sm text-muted-foreground">
              Attach these to Essential, Priority, or Concierge.
            </p>

            <div className="mt-12 grid gap-6 md:grid-cols-2">
              {/* Permit Email Assistant */}
              <div className="rounded-2xl border border-border bg-card p-8">
                <div className="flex items-baseline justify-between gap-4">
                  <h3 className="font-heading text-xl font-semibold">
                    {emailAssistantAddOn.name}
                  </h3>
                  <span className="font-heading text-2xl font-semibold tracking-tight">
                    {emailAssistantAddOn.priceLabel}
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {emailAssistantAddOn.description}
                </p>
                <ul className="mt-5 space-y-3 text-sm">
                  {emailAssistantAddOn.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span className="text-foreground/90">{f}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-5 text-xs italic text-muted-foreground">
                  {emailAssistantAddOn.disclaimer}
                </p>
              </div>

              {/* Homeowner live link */}
              <div className="rounded-2xl border border-border bg-card p-8">
                <h3 className="font-heading text-xl font-semibold">
                  Homeowner live link
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {homeownerLinkDescription}
                </p>
                <ul className="mt-5 space-y-3">
                  {homeownerLinkTiers.map((t) => (
                    <li
                      key={t.name}
                      className="flex items-baseline justify-between gap-4 border-b border-border/50 pb-3 last:border-0 last:pb-0"
                    >
                      <div>
                        <p className="font-medium text-foreground/90">
                          {t.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t.limit}
                        </p>
                      </div>
                      <span className="font-heading text-lg font-semibold tracking-tight">
                        {t.priceLabel}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* What's not included */}
        <section className="px-6 py-20 md:px-10">
          <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-card p-8">
            <h2 className="font-heading text-2xl font-semibold tracking-tight">
              What no plan includes
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              So there are no surprises after signup.
            </p>
            <ul className="mt-5 grid gap-2 text-sm text-foreground/90 sm:grid-cols-2">
              {notIncludedList.map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <span
                    aria-hidden
                    className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/70"
                  />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-5 text-xs text-muted-foreground">
              {notIncludedFootnote}
            </p>
          </div>
        </section>

        {/* Comparison table (desktop) */}
        <section className="hidden border-t border-border/60 bg-secondary/30 px-6 py-24 md:block md:px-10">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-center font-heading text-3xl font-semibold tracking-tight md:text-4xl">
              Compare plans
            </h2>

            <div className="mt-12 overflow-x-auto rounded-2xl border border-border bg-card">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-6 py-4 font-heading font-semibold">
                      Feature
                    </th>
                    {subscriptionTiers.map((tier) => (
                      <th
                        key={tier.name}
                        className="px-6 py-4 font-heading font-semibold"
                      >
                        {tier.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows.map((row, i) => (
                    <tr
                      key={row.label}
                      className={
                        i !== comparisonRows.length - 1
                          ? "border-b border-border/60"
                          : undefined
                      }
                    >
                      <td className="px-6 py-4 font-medium text-foreground/90">
                        {row.label}
                      </td>
                      {row.values.map((value, idx) => (
                        <td
                          key={idx}
                          className="px-6 py-4 text-muted-foreground"
                        >
                          {value}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="px-6 py-24 md:px-10">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-center font-heading text-3xl font-semibold tracking-tight md:text-4xl">
              Frequently asked questions
            </h2>

            <Accordion type="single" collapsible className="mt-10">
              {faqs.map((faq) => (
                <AccordionItem key={faq.question} value={faq.question}>
                  <AccordionTrigger className="text-left font-heading text-base font-medium">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        {/* Contact form */}
        <section
          id="contact"
          className="border-t border-border/60 bg-secondary/30 scroll-mt-24 px-6 py-24 md:px-10"
        >
          <div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-2">
            <div>
              <h2 className="font-heading text-3xl font-semibold tracking-tight md:text-4xl">
                Talk to Angelique
              </h2>
              <p className="mt-4 text-muted-foreground">
                No self-serve checkout. Send a short note and Angelique will
                reply personally to set up a call and send the payment link once
                we agree on the right plan.
              </p>
              <dl className="mt-8 space-y-3 text-sm">
                <div className="flex items-baseline gap-3">
                  <dt className="w-16 shrink-0 font-medium text-foreground/80">
                    Email
                  </dt>
                  <dd>
                    <a
                      className="text-primary underline"
                      href="mailto:Hello@Permitaio.com"
                    >
                      Hello@Permitaio.com
                    </a>
                  </dd>
                </div>
                <div className="flex items-baseline gap-3">
                  <dt className="w-16 shrink-0 font-medium text-foreground/80">
                    Where
                  </dt>
                  <dd className="text-muted-foreground">
                    Deerfield Beach, FL — serving South Florida contractors.
                  </dd>
                </div>
              </dl>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6 md:p-8">
              <ContactForm />
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="border-t border-border/60 bg-primary px-6 py-20 text-center md:px-10">
          <div className="mx-auto max-w-2xl">
            <h2 className="font-heading text-3xl font-semibold tracking-tight text-primary-foreground md:text-4xl">
              Ready to bring every permit tool under one Job number?
            </h2>
            <Button size="lg" variant="secondary" asChild className="mt-8">
              <a href="#contact">
                Contact us <ArrowRight className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
