/** Hide PostgREST internals. Missing tables show as an empty board, not a schema error. */
export function cleanTableNote(message?: string | null): string {
  if (!message) return "";
  if (/schema cache|could not find the table/i.test(message)) return "";
  return message;
}
