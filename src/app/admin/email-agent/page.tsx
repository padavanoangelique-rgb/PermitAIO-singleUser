import { createAdminClient } from "@/lib/supabase/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const GMAIL_ERROR_MESSAGES: Record<string, string> = {
  missing_code: "Google didn't return an authorization code. Try connecting again.",
  bad_state: "That connection link expired or was tampered with. Try connecting again.",
  nonce_mismatch: "That connection link expired. Try connecting again.",
  token_exchange_failed: "Google rejected the connection. Try again.",
  no_refresh_token: "Google didn't grant offline access. Try again — make sure to approve when prompted.",
  wrong_account:
    "That Google account isn't the authorized mailbox. The Email Agent can only connect agent@permitaio.com.",
  access_denied: "The Google sign-in was cancelled.",
};

interface GmailConnectionRow {
  google_email: string;
  status: "connected" | "disconnected" | "error";
  granted_scopes: string[];
  gmail_history_id: string | null;
  last_error: string | null;
  connected_at: string | null;
}

interface DiscoveryRow {
  id: string;
  job_id: string;
  message: string;
  created_at: string;
  job_number: string;
  client_name: string;
  stage: string;
  sub_status: string;
}

function adminFrom(admin: ReturnType<typeof createAdminClient>, table: string) {
  return (admin as unknown as { from: (name: string) => any }).from(table);
}

async function loadDiscoveries(
  admin: ReturnType<typeof createAdminClient>,
  marker: string,
): Promise<DiscoveryRow[]> {
  const { data: notes } = await adminFrom(admin, "job_activity")
    .select("id, job_id, message, created_at")
    .eq("activity_type", "system")
    .ilike("message", `%${marker}%`)
    .order("created_at", { ascending: false })
    .limit(30);

  const rows = (notes ?? []) as {
    id: string;
    job_id: string;
    message: string;
    created_at: string;
  }[];
  const jobIds = [...new Set(rows.map((row) => row.job_id))];
  const jobsById = new Map<
    string,
    { job_number: string; client_name: string; stage: string; sub_status: string }
  >();
  if (jobIds.length) {
    const { data: jobs } = await adminFrom(admin, "jobs")
      .select("id, job_number, client_name, stage, sub_status")
      .in("id", jobIds);
    for (const job of jobs ?? []) jobsById.set(job.id, job);
  }

  return rows.map((row) => {
    const job = jobsById.get(row.job_id);
    return {
      id: row.id,
      job_id: row.job_id,
      message: row.message,
      created_at: row.created_at,
      job_number: job?.job_number ?? "—",
      client_name: job?.client_name ?? "—",
      stage: job?.stage ?? "—",
      sub_status: job?.sub_status ?? "—",
    };
  });
}

function DiscoveryList({ rows, empty }: { rows: DiscoveryRow[]; empty: string }) {
  if (rows.length === 0) {
    return <p className="text-muted-foreground">{empty}</p>;
  }
  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.id} className="rounded-md border px-3 py-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-medium">
              {row.job_number} · {row.client_name}
            </span>
            <span className="text-xs text-muted-foreground">
              {new Date(row.created_at).toLocaleString()}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {row.stage} / {row.sub_status}
          </p>
          <p className="mt-1 text-sm leading-snug">{row.message}</p>
        </li>
      ))}
    </ul>
  );
}

export default async function EmailAgentPage({
  searchParams,
}: {
  searchParams: Promise<{ gmail?: string; reason?: string; got?: string }>;
}) {
  const { gmail, reason, got } = await searchParams;

  let connection: GmailConnectionRow | null = null;
  let statusInDiscoveries: DiscoveryRow[] = [];
  let statusOutDiscoveries: DiscoveryRow[] = [];
  let noteDiscoveries: DiscoveryRow[] = [];
  let intakeDiscoveries: DiscoveryRow[] = [];
  let bulkDiscoveries: DiscoveryRow[] = [];

  try {
    const admin = createAdminClient();
    const { data } = await adminFrom(admin, "gmail_connections")
      .select("google_email, status, granted_scopes, gmail_history_id, last_error, connected_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    connection = data ?? null;
    statusInDiscoveries = await loadDiscoveries(admin, "[Status In]");
    statusOutDiscoveries = await loadDiscoveries(admin, "[Status Out]");
    noteDiscoveries = await loadDiscoveries(admin, "[Email Agent]");
    intakeDiscoveries = await loadDiscoveries(admin, "[Intake Agent]");
    bulkDiscoveries = await loadDiscoveries(admin, "[Bulk Agent]");
  } catch {
    connection = connection ?? null;
  }

  const isConnected = connection?.status === "connected";

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Email Agent</h1>
        <p className="text-sm text-muted-foreground">
          Status In = the city told you the status. Status Out = a person asked you for a
          status. Two roles. Notes never change stage.
        </p>
      </div>

      {gmail === "connected" && (
        <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Gmail connected.
        </div>
      )}
      {gmail === "error" && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {(reason && GMAIL_ERROR_MESSAGES[reason]) || "Couldn't connect Gmail. Try again."}
          {reason === "wrong_account" && got ? ` (signed in as ${got})` : null}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-heading">Gmail connection</CardTitle>
          <CardDescription>agent@permitaio.com · gmail.modify only</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {isConnected ? (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{connection?.google_email}</p>
                  <p className="text-xs text-muted-foreground">
                    Connected
                    {connection?.connected_at
                      ? ` ${new Date(connection.connected_at).toLocaleString()}`
                      : ""}
                  </p>
                </div>
                <Badge variant="secondary">Connected</Badge>
              </div>
              <form action="/api/integrations/gmail/disconnect" method="post">
                <Button type="submit" variant="outline">
                  Disconnect
                </Button>
              </form>
            </>
          ) : (
            <form action="/api/integrations/gmail/connect" method="get">
              <Button type="submit">Connect Gmail</Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-heading">Status In — city told you</CardTitle>
          <CardDescription>
            Building department issued, approved, corrections, fees, inspection. You already
            have the update. Status does not change.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <form action="/api/admin/email-agent/replay" method="post">
            <Button type="submit" variant="outline">
              Scan last 12 inbox messages
            </Button>
          </form>
          <DiscoveryList rows={statusInDiscoveries} empty="No Status In notes yet." />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-heading">Status Out — they asked you</CardTitle>
          <CardDescription>
            Homeowner, coworker, or client wants a status. Next action is reply with a job
            update. Status does not change.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm">
          <DiscoveryList
            rows={statusOutDiscoveries}
            empty="No Status Out requests yet. Forward a 'need an update' email to agent@."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-heading">Other note discoveries</CardTitle>
          <CardDescription>Matched job mail that was not Status In or Status Out.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm">
          <DiscoveryList rows={noteDiscoveries} empty="No leftover note-agent discoveries." />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-heading">Intake agent preview</CardTitle>
          <CardDescription>
            Jobs created from a NEW JOBS list. Status is Need Permit Submittal / Need to
            Submit.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm">
          <DiscoveryList
            rows={intakeDiscoveries}
            empty="No jobs created by intake yet. Send a NEW JOBS list to agent@."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-heading">Bulk update agent</CardTitle>
          <CardDescription>
            Listed job numbers only. One field, one value. Dates or permit status. Never the
            whole queue.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm">
          <DiscoveryList
            rows={bulkDiscoveries}
            empty="No bulk updates yet. Email agent@ a BULK UPDATE list."
          />
        </CardContent>
      </Card>
    </div>
  );
}
