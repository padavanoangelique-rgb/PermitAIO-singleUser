import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/data/orgs";
import { requirePlatformAdmin } from "@/lib/data/platform-admin";
import { createAdminClient } from "@/lib/supabase/admin";

function adminTable(admin: ReturnType<typeof createAdminClient>, table: string) {
  return (admin as unknown as { from: (t: string) => any }).from(table);
}

interface ColumnMappingInput {
  column_index: number;
  column_header: string;
  target_field: string;
  is_match_key: boolean;
}

/**
 * Saves (or re-confirms) a sheet connection's mapping. Always inserts a new
 * `sheet_mapping_versions` row rather than editing one in place — mapping
 * history is never overwritten, only superseded.
 */
export async function POST(request: NextRequest) {
  const user = await requireUser();
  await requirePlatformAdmin();

  const body = await request.json();
  const {
    connectionId,
    orgId,
    grantId,
    displayName,
    spreadsheetId,
    spreadsheetName,
    tabName,
    tabSheetId,
    priority,
    headerRow,
    mappings,
  } = body as {
    connectionId?: string;
    orgId: string;
    grantId: string;
    displayName: string;
    spreadsheetId: string;
    spreadsheetName: string;
    tabName: string;
    tabSheetId: number | null;
    priority: number;
    headerRow: number;
    mappings: ColumnMappingInput[];
  };

  if (!mappings.some((m) => m.is_match_key)) {
    return NextResponse.json({ error: "One column must be marked as the Job # match key." }, { status: 400 });
  }

  const admin = createAdminClient();

  let resolvedConnectionId = connectionId;
  if (resolvedConnectionId) {
    const { error } = await adminTable(admin, "sheet_connections")
      .update({
        display_name: displayName,
        spreadsheet_name: spreadsheetName,
        tab_sheet_id: tabSheetId,
        priority,
        status: "active",
        last_error: null,
      })
      .eq("id", resolvedConnectionId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { data, error } = await adminTable(admin, "sheet_connections")
      .insert({
        org_id: orgId,
        grant_id: grantId,
        display_name: displayName,
        spreadsheet_id: spreadsheetId,
        spreadsheet_name: spreadsheetName,
        tab_name: tabName,
        tab_sheet_id: tabSheetId,
        priority,
        status: "active",
        created_by: user.id,
      })
      .select("id")
      .single();
    if (error || !data) return NextResponse.json({ error: error?.message ?? "Insert failed." }, { status: 500 });
    resolvedConnectionId = data.id;
  }

  const { data: existingVersions } = await adminTable(admin, "sheet_mapping_versions")
    .select("version")
    .eq("connection_id", resolvedConnectionId)
    .order("version", { ascending: false })
    .limit(1);
  const nextVersion = (existingVersions?.[0]?.version ?? 0) + 1;

  await adminTable(admin, "sheet_mapping_versions")
    .update({ is_current: false })
    .eq("connection_id", resolvedConnectionId)
    .eq("is_current", true);

  const { error: versionError } = await adminTable(admin, "sheet_mapping_versions").insert({
    connection_id: resolvedConnectionId,
    org_id: orgId,
    version: nextVersion,
    header_row: headerRow,
    mappings,
    is_current: true,
    created_by: user.id,
  });
  if (versionError) return NextResponse.json({ error: versionError.message }, { status: 500 });

  return NextResponse.json({ ok: true, connectionId: resolvedConnectionId, version: nextVersion });
}
