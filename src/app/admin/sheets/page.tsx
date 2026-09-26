import { createAdminClient } from "@/lib/supabase/admin";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { OrgPicker } from "./org-picker";
import { ConnectSheetWizard } from "./connect-sheet-wizard";
import { SyncNowButton } from "./sync-now-button";
import { DisconnectButton } from "./disconnect-button";

const SHEETS_ERROR_MESSAGES: Record<string, string> = {
  missing_code: "Google didn't return an authorization code. Try connecting again.",
  bad_state: "That connection link expired or was tampered with. Try connecting again.",
  nonce_mismatch: "That connection link expired. Try connecting again.",
  no_refresh_token: "Google didn't grant offline access. Try connecting again.",
  token_exchange_failed: "Google rejected the connection. Try again.",
  access_denied: "The Google sign-in was cancelled.",
};

function adminTable(admin: ReturnType<typeof createAdminClient>, table: string) {
  return (admin as unknown as { from: (t: string) => any }).from(table);
}

interface ConnectionRow {
  id: string;
  display_name: string;
  spreadsheet_id: string;
  spreadsheet_name: string | null;
  tab_name: string;
  priority: number;
  status: "active" | "paused" | "error";
  last_error: string | null;
  last_synced_at: string | null;
}

export default async function SheetsAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string; sheets?: string; reason?: string }>;
}) {
  const { org: selectedOrgId, sheets, reason } = await searchParams;
  const admin = createAdminClient();

  const { data: orgs } = await adminTable(admin, "organizations")
    .select("id, name")
    .order("name", { ascending: true });

  let grantId: string | null = null;
  let grantEmail: string | null = null;
  let connections: ConnectionRow[] = [];

  if (selectedOrgId) {
    const { data: grant } = await adminTable(admin, "sheet_oauth_grants")
      .select("id, google_email")
      .eq("org_id", selectedOrgId)
      .eq("status", "connected")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    grantId = grant?.id ?? null;
    grantEmail = grant?.google_email ?? null;

    const { data: conns } = await adminTable(admin, "sheet_connections")
      .select("id, display_name, spreadsheet_id, spreadsheet_name, tab_name, priority, status, last_error, last_synced_at")
      .eq("org_id", selectedOrgId)
      .order("priority", { ascending: true });
    connections = (conns ?? []) as ConnectionRow[];
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Sheets</h1>
        <p className="text-sm text-muted-foreground">
          Connect a company&apos;s own Google Sheet(s) and PermitAIO keeps their jobs updated automatically —
          on demand and 3x a day. Read-only: never writes back to the sheet.
        </p>
      </div>

      {sheets === "connected" && (
        <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Google account connected.
        </div>
      )}
      {sheets === "error" && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {(reason && SHEETS_ERROR_MESSAGES[reason]) || "Couldn't connect that Google account. Try again."}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-heading">Company</CardTitle>
          <CardDescription>Pick who this sheet belongs to.</CardDescription>
        </CardHeader>
        <CardContent>
          <OrgPicker orgs={orgs ?? []} selectedOrgId={selectedOrgId ?? null} />
        </CardContent>
      </Card>

      {selectedOrgId && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base font-heading">
                {orgs?.find((o: { id: string; name: string }) => o.id === selectedOrgId)?.name} — Agent check
              </CardTitle>
              <CardDescription>
                {grantEmail ? `Connected via ${grantEmail}` : "No Google account connected for this company yet."}
              </CardDescription>
            </div>
            <ConnectSheetWizard orgId={selectedOrgId} grantId={grantId} />
          </CardHeader>
          <CardContent className="space-y-4">
            {connections.length === 0 && (
              <p className="text-sm text-muted-foreground">No sheets connected yet.</p>
            )}
            {connections.map((conn) => (
              <div key={conn.id} className="rounded-md border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{conn.display_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {conn.spreadsheet_name ?? conn.spreadsheet_id} · tab &quot;{conn.tab_name}&quot; · priority{" "}
                      {conn.priority}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {conn.last_synced_at
                        ? `Last synced ${new Date(conn.last_synced_at).toLocaleString()}`
                        : "Never synced"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={conn.status === "error" ? "destructive" : "secondary"}>{conn.status}</Badge>
                    <SyncNowButton connectionId={conn.id} />
                    <ConnectSheetWizard
                      orgId={selectedOrgId}
                      grantId={grantId}
                      editingConnection={{
                        id: conn.id,
                        displayName: conn.display_name,
                        spreadsheetId: conn.spreadsheet_id,
                        spreadsheetName: conn.spreadsheet_name ?? "",
                        tabName: conn.tab_name,
                        priority: conn.priority,
                      }}
                    />
                    <DisconnectButton connectionId={conn.id} />
                  </div>
                </div>
                {conn.status === "error" && conn.last_error && (
                  <p className="mt-2 text-xs text-destructive">{conn.last_error}</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
