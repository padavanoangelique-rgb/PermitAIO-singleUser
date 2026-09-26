// Deliberately has no `import "server-only"` — this file is shared by the
// server-side engine and the client-side upload form, so it can only ever
// hold plain types/constants, never a database or fetch call.
export type DataAgentInstruction = "add_new_jobs" | "update_status" | "update_dates" | "fill_missing";

export const DATA_AGENT_INSTRUCTIONS: { value: DataAgentInstruction; label: string }[] = [
  { value: "add_new_jobs", label: "Add new jobs" },
  { value: "update_status", label: "Update status" },
  { value: "update_dates", label: "Update dates" },
  { value: "fill_missing", label: "Fill in missing fields" },
];
