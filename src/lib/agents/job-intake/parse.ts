export type IntakeLine = {
  jobNumber: string;
  clientName: string;
};

export type ParsedIntake = {
  isIntake: boolean;
  tech: string | null;
  lines: IntakeLine[];
  skipped: string[];
};

const TECHS = ["Permit Tech 1", "Permit Tech 2", "Permit Tech 3"];

export function isIntakeEmail(subject: string, body: string): boolean {
  const text = `${subject}\n${body}`;
  if (/permitaio\/intake/i.test(text)) return true;
  if (/\bNEW JOBS\b/i.test(text)) return true;
  if (/^TECH\s*:/im.test(text) && /\|/.test(text)) return true;
  return false;
}

function matchTech(value: string): string | null {
  const compact = value.toLowerCase().replace(/\s+/g, " ").trim();
  return TECHS.find((tech) => compact.includes(tech.toLowerCase())) ?? null;
}

export function parseIntakeEmail(subject: string, body: string): ParsedIntake {
  const text = `${subject}\n${body}`;
  if (!isIntakeEmail(subject, body)) {
    return { isIntake: false, tech: null, lines: [], skipped: [] };
  }

  let tech: string | null = null;
  const lines: IntakeLine[] = [];
  const skipped: string[] = [];
  const seen = new Set<string>();

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\s+/g, " ").trim();
    if (!line) continue;
    if (/^new jobs$/i.test(line)) continue;
    if (/^tech\s*:/i.test(line)) {
      tech = matchTech(line) ?? tech;
      continue;
    }
    if (/permit issued|permit approved|corrections required/i.test(line)) continue;

    const parts = line.split("|").map((part) => part.trim());
    if (parts.length < 2) {
      if (/\|/.test(line) === false && /\d/.test(line)) skipped.push(line);
      continue;
    }

    const jobNumber = parts[0].replace(/^#/, "").trim();
    const clientName = parts.slice(1).join(" | ").trim();
    if (!jobNumber || jobNumber.length < 3 || !clientName) {
      skipped.push(line);
      continue;
    }
    const key = jobNumber.toLowerCase();
    if (seen.has(key)) {
      skipped.push(`duplicate in email: ${jobNumber}`);
      continue;
    }
    seen.add(key);
    lines.push({ jobNumber, clientName });
  }

  return { isIntake: true, tech, lines, skipped };
}
