import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/data/orgs";
import { requirePlatformAdmin } from "@/lib/data/platform-admin";
import { getValidAccessToken } from "@/lib/sheets/db";
import { previewTab } from "@/lib/agents/sheet-sync/read";
import { suggestFieldForHeader } from "@/lib/agents/sheet-sync/validate";

export async function POST(request: NextRequest) {
  await requireUser();
  await requirePlatformAdmin();

  const body = await request.json();
  const { grantId, spreadsheetId, tabName } = body as {
    grantId?: string;
    spreadsheetId?: string;
    tabName?: string;
  };
  if (!grantId || !spreadsheetId || !tabName) {
    return NextResponse.json({ error: "Missing grantId, spreadsheetId, or tabName." }, { status: 400 });
  }

  const accessToken = await getValidAccessToken(grantId);
  if (!accessToken) {
    return NextResponse.json({ error: "This Google account's access has expired — reconnect it." }, { status: 401 });
  }

  try {
    const { headers, sampleRows } = await previewTab(accessToken, spreadsheetId, tabName);
    const suggestions = headers.map((header) => suggestFieldForHeader(header));
    return NextResponse.json({ headers, sampleRows, suggestions });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't read that tab." },
      { status: 502 },
    );
  }
}
