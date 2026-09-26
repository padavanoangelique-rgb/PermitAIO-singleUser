import Link from "next/link";
import { BOTS } from "@/lib/chat/bots";
import { mailboxForBot } from "@/lib/chat/mailboxes";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ResearchFeed } from "@/components/chat/research-feed";

/** Platform-owner controls for Xena. Not a company-settings card. */
export function GrokManagerCard({ slug }: { slug: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-base">Xena — Warrior Manager</CardTitle>
        <CardDescription>
          You control Xena from the Owner Console — not the company. She talks to Investigator and the
          Permit Form Specialist when a question is about checklists, submittals, building code, or
          forms. Techs do not open her. Feed a report here or paste it in this Grok chat.{" "}
          <Link href="/settings/ask" className="font-medium text-primary underline-offset-2 hover:underline">
            Print the how-to
          </Link>
          {" · "}
          <Link href="/settings/agents" className="font-medium text-primary underline-offset-2 hover:underline">
            Agent workbook
          </Link>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <ResearchFeed />
        {BOTS.map((bot) => {
          const mailbox = mailboxForBot(bot.id, slug) ?? bot.mailbox;
          return (
            <div key={bot.id} className="rounded-2xl border px-4 py-3">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <p className="text-sm font-semibold">{bot.name}</p>
                <p className="text-xs text-muted-foreground">{bot.who}</p>
                {mailbox ? <p className="text-xs font-medium text-primary">{mailbox}</p> : null}
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{bot.rules}</p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
