/**
 * Short summary of an email for the job log. Drops quoted history and signatures' worth of
 * trailing reply chain so only the new text is kept, then trims to `max` characters.
 */
export function emailSnippet(text: string, max = 500): string {
  const lines = String(text || "").replace(/\r/g, "").split("\n");
  const kept: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (/^on .+wrote:?$/i.test(t)) break;
    if (/^-{2,}\s*original message\s*-{2,}$/i.test(t)) break;
    if (/^from:\s.+/i.test(t) && kept.length > 0) break;
    if (t.startsWith(">")) continue;
    kept.push(line);
  }
  const cleaned = kept.join(" ").replace(/\s+/g, " ").trim();
  return cleaned.length > max ? `${cleaned.slice(0, max - 1)}…` : cleaned;
}

/** Plain text from an HTML email body (only used when a message has no text part). */
export function htmlToText(html: string): string {
  return String(html || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
}
