import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/data/orgs";
import { requirePlatformAdmin } from "@/lib/data/platform-admin";
import { getValidAccessToken } from "@/lib/sheets/db";
import { listTabs } from "@/lib/agents/sheet-sync/read";

function extractSpreadsheetId(input: string): string | null {
  const urlMatch = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (urlMatch) return urlMatch[1];
  if (/^[a-zA-Z0-9-_]{20,}$/.test(input.trim())) return input.trim();
  return null;
}

export async function POST(request: NextRequest) {
  await requireUser();
  await requirePlatformAdmin();

  const body = await request.json();
  const { grantId, spreadsheetUrlOrId } = body as { grantId?: string; spreadsheetUrlOrId?: string };
  if (!grantId || !spreadsheetUrlOrId) {
    return NextResponse.json({ error: "Missing grantId or spreadsheetUrlOrId." }, { status: 400 });
  }

  const spreadsheetId = extractSpreadsheetId(spreadsheetUrlOrId);
  if (!spreadsheetId) {
    return NextResponse.json({ error: "Couldn't read a spreadsheet ID from that URL." }, { status: 400 });
  }

  const accessToken = await getValidAccessToken(grantId);
  if (!accessToken) {
    return NextResponse.json({ error: "This Google account's access has expired — reconnect it." }, { status: 401 });
  }

  try {
    const { spreadsheetName, tabs } = await listTabs(accessToken, spreadsheetId);
    return NextResponse.json({ spreadsheetId, spreadsheetName, tabs });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't read that spreadsheet." },
      { status: 502 },
    );
  }
}
