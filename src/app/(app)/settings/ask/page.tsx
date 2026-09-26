import Link from "next/link";
import { PrintButton } from "./print-button";
import { permitAgentMailbox, hoaAgentMailbox } from "@/lib/chat/mailboxes";
import { canManageOrg, requireActiveOrg } from "@/lib/data/orgs";

export default async function AskHowToPage() {
  const { role, activeOrg } = await requireActiveOrg();
  const isAdmin = canManageOrg(role);
  const permitBox = permitAgentMailbox(activeOrg.slug);
  const hoaBox = hoaAgentMailbox(activeOrg.slug);

  return (
    <div className="mx-auto max-w-3xl space-y-8 print:max-w-none print:space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <Link href="/settings" className="text-sm text-muted-foreground hover:text-foreground">
          ← Settings
        </Link>
        <div className="flex items-center gap-3">
          {isAdmin ? (
            <Link href="/settings/playbook" className="text-sm font-medium text-primary underline-offset-2 hover:underline">
              Role tutorials
            </Link>
          ) : null}
          {isAdmin ? (
            <Link href="/settings/agents" className="text-sm font-medium text-primary underline-offset-2 hover:underline">
              Agent workbook
            </Link>
          ) : null}
          <PrintButton />
          <a
            href="/Ask-PermitAIO-how-it-works.pdf"
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center rounded-full border px-3 text-sm font-medium hover:bg-muted"
          >
            Printable PDF
          </a>
        </div>
      </div>

      <header className="border-b pb-4">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">PermitAIO</p>
        <h1 className="mt-1 font-heading text-3xl font-semibold tracking-tight">Ask PermitAIO — how we use it</h1>
        <p className="mt-2 text-base text-muted-foreground">Print this. Keep it by the desk. One brain. Everyone talks to it the same way.</p>
      </header>

      <section className="space-y-2">
        <h2 className="font-heading text-xl font-semibold">What it is</h2>
        <p className="text-base leading-relaxed">
          The purple <strong>Ask PermitAIO</strong> button is on every page. Anyone in the company can open it.
          You ask in plain English. It searches the shop — jobs, HOA, NOAs, forms, building depts, correction
          lessons, and research reports — then answers like a coworker. It does not invent.
        </p>
        <p className="text-base leading-relaxed">
          It gets better the more you run work through it. Every job, every letter you attach, every{" "}
          <em>Save this</em> on a city comment is memory for the next packet in that jurisdiction. You are not
          training a chatbot. You are filling the shop.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-heading text-xl font-semibold">Set up once</h2>
        <ol className="list-decimal space-y-2 pl-5 text-base leading-relaxed">
          <li>
            <strong>Give each person a desk.</strong> Settings → their name. Turn on Permit tech, HOA tech, or both.
            Permit techs see the Permit desk. HOA techs see the HOA desk. Everyone sees Main.
          </li>
          <li>
            <strong>Load the starting brain.</strong> When Investigator and the Permit Form Specialist finish a report,
            open Ask PermitAIO (or Settings → Grok Manager) → <em>Feed a research report</em>. Paste it. Pick who
            wrote it. County / city. Load into him.
          </li>
          <li>
            <strong>Keep Libraries full.</strong> Forms, NOAs, and Building depts are what he reads. If it is not in
            Libraries, he cannot answer it.
          </li>
          <li>
            <strong>Mailboxes (when Google is ready).</strong> Create aliases on{" "}
            <span className="font-medium">agent@permitaio.com</span> named after the company — not the word
            “client.” This shop:{" "}
            <span className="font-medium">{permitBox}</span> and{" "}
            <span className="font-medium">{hoaBox}</span>. Example: Guardian →
            guardian_permitagent@permitaio.com. Permit mail dings the permit tech. HOA mail sticks to the
            job and dings the HOA tech.
          </li>
        </ol>
      </section>

      <section className="space-y-2">
        <h2 className="font-heading text-xl font-semibold">Every day</h2>
        <div className="overflow-hidden rounded-2xl border">
          <table className="w-full text-left text-base">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 font-semibold">When</th>
                <th className="px-3 py-2 font-semibold">Open</th>
                <th className="px-3 py-2 font-semibold">Say</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              <tr>
                <td className="px-3 py-2">On the phone with a customer</td>
                <td className="px-3 py-2">Main</td>
                <td className="px-3 py-2">“What’s going on with job #____ / client ____?”</td>
              </tr>
              <tr>
                <td className="px-3 py-2">Need it on the job, nothing else</td>
                <td className="px-3 py-2">Main or Permit</td>
                <td className="px-3 py-2">“Make a note on job #____: …” or “approved pending issuance — note only.”</td>
              </tr>
              <tr>
                <td className="px-3 py-2">You submitted it / status changed</td>
                <td className="px-3 py-2">Main or Permit</td>
                <td className="px-3 py-2">“I submitted job #____, permit #____.” or “Mark 86670-1 approved.” Direct command — it updates the job.</td>
              </tr>
              <tr>
                <td className="px-3 py-2">Preparing or checking a submittal</td>
                <td className="px-3 py-2">Permit</td>
                <td className="px-3 py-2">City + trade. “What do they want? Which forms? Step by step.”</td>
              </tr>
              <tr>
                <td className="px-3 py-2">City sent a comment or letter</td>
                <td className="px-3 py-2">Corrections</td>
                <td className="px-3 py-2">Upload the letter on Attach, or paste the comment. When the answer is right, say “Save this.”</td>
              </tr>
              <tr>
                <td className="px-3 py-2">HOA question</td>
                <td className="px-3 py-2">HOA</td>
                <td className="px-3 py-2">Association or job #. Contacts, notes, meetings, turnaround.</td>
              </tr>
              <tr>
                <td className="px-3 py-2">Something in the app broke</td>
                <td className="px-3 py-2">Support</td>
                <td className="px-3 py-2">What you clicked. Job # if you have it. It waits for owner approval.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-base leading-relaxed">
          Main always gives the full recap: permit, HOA, orders, dates, cycle time. Use that when you’re on the line.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-heading text-xl font-semibold">Teach him</h2>
        <ul className="list-disc space-y-2 pl-5 text-base leading-relaxed">
          <li>
            <strong>City sent a correction.</strong> Ask PermitAIO → <em>Corrections</em> → <em>Attach</em> the letter
            or paste the comment. When the answer is right, type <em>Save this</em>. He keeps it as a city lesson.
          </li>
          <li>
            <strong>Research report is ready.</strong> <em>Feed a research report</em>. Investigator = code, checklist,
            how to submit. Form Specialist = which forms for which city.
          </li>
          <li>
            <strong>New form, NOA, or building dept note.</strong> Put it in Libraries. Don’t paste it into chat.
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="font-heading text-xl font-semibold">Who talks to whom</h2>
        <p className="text-base leading-relaxed">
          You don’t run six bots. You talk to <strong>Manager</strong> (Settings → Grok Manager, or this Grok chat).
          Manager talks to Investigator and the Permit Form Specialist when the question is about code, checklists,
          submittals, or forms. You’ll see “Checked with Investigator” or “Form Specialist.” Then you get a human answer.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-heading text-xl font-semibold">Rules he already follows</h2>
        <ul className="list-disc space-y-1 pl-5 text-base leading-relaxed">
          <li>Job number is the source of truth.</li>
          <li>He searches. If it isn’t on file, he says so. He does not invent status, contacts, forms, or code.</li>
          <li>Make a note / note only = a note. Status does not move.</li>
          <li>A direct command (“I submitted…”, “mark approved”, “set to In Review”) changes permit status on that job.</li>
          <li>Support does not go live until you approve.</li>
          <li>To change a rule: tell Manager here, or write it on Settings → Grok Manager.</li>
        </ul>
      </section>

      <footer className="border-t pt-4 text-sm text-muted-foreground">
        Keep this sheet next to the phone. Ask PermitAIO — Main — job # or client name.
      </footer>
    </div>
  );
}
