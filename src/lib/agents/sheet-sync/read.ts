import "server-only";

// Thin fetch wrappers around the Google Sheets REST API — no SDK, matching
// this codebase's existing convention for every other Google integration
// (src/lib/gmail/*, src/lib/crm/dynamics365.ts all hand-roll fetch calls).

const SHEETS_API_BASE = "https://sheets.googleapis.com/v4/spreadsheets";

/** Google Sheets range syntax requires a tab name to be single-quoted
 * whenever it contains a space or other special character (Guardian's own
 * tabs do) — embedded quotes are escaped by doubling them. */
function quoteTabName(tabName: string): string {
  return `'${tabName.replace(/'/g, "''")}'`;
}

export interface SheetTab {
  title: string;
  sheetId: number;
}

export async function listTabs(accessToken: string, spreadsheetId: string): Promise<{
  spreadsheetName: string;
  tabs: SheetTab[];
}> {
  const url = `${SHEETS_API_BASE}/${spreadsheetId}?fields=properties.title,sheets.properties.title,sheets.properties.sheetId`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) {
    throw new Error(`Sheets metadata request failed (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as {
    properties?: { title?: string };
    sheets?: { properties: { title: string; sheetId: number } }[];
  };
  return {
    spreadsheetName: data.properties?.title ?? spreadsheetId,
    tabs: (data.sheets ?? []).map((s) => ({ title: s.properties.title, sheetId: s.properties.sheetId })),
  };
}

/** Reads a range as raw string rows (Sheets' UNFORMATTED_VALUE would lose
 * date formatting we want to parse ourselves — FORMATTED_VALUE keeps
 * whatever the sheet displays, which is what a human mapped against). */
export async function readRange(
  accessToken: string,
  spreadsheetId: string,
  range: string,
): Promise<string[][]> {
  const url = `${SHEETS_API_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}?valueRenderOption=FORMATTED_VALUE`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) {
    throw new Error(`Sheets values request failed (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as { values?: string[][] };
  return data.values ?? [];
}

/** Header row + up to 20 sample rows, for the mapping-preview step. */
export async function previewTab(
  accessToken: string,
  spreadsheetId: string,
  tabName: string,
): Promise<{ headers: string[]; sampleRows: string[][] }> {
  const rows = await readRange(accessToken, spreadsheetId, `${quoteTabName(tabName)}!A1:Z21`);
  const [headers = [], ...sampleRows] = rows;
  return { headers, sampleRows };
}

/** Full mapped column range for a sync run — reads every row from row 2
 * through the last populated row in column A (used to bound the range). */
export async function readFullTab(
  accessToken: string,
  spreadsheetId: string,
  tabName: string,
  headerRow: number,
): Promise<string[][]> {
  const rows = await readRange(accessToken, spreadsheetId, `${quoteTabName(tabName)}!A${headerRow + 1}:ZZ`);
  return rows;
}
