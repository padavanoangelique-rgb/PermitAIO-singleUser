import type { ReactNode } from "react";
import { createElement } from "react";

export type PortalLink = { label: string; url: string };

export type ParsedContact = {
  address: string[];
  phone: string | null;
  emails: string[];
  portalUrls: PortalLink[];
  extra: string;
};

const PHONE_RE = /(\+?1?[\s.-]*\(?\d{3}\)?[\s.-]*\d{3}[\s.-]*\d{4})/;
const URL_RE = /(https?:\/\/[^\s)]+|www\.[^\s)]+)/gi;
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const LABELED_URL = /^([^:]{2,60}):\s*((?:https?:\/\/|www\.)\S+)$/i;

export function normalizeUrl(raw: string): string {
  const trimmed = raw.replace(/[.,;]+$/, "");
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^www\./i.test(trimmed)) return `https://${trimmed}`;
  return trimmed;
}

export function parseContactNotes(text: string): ParsedContact {
  const lines = text.split(/\r?\n/);
  const address: string[] = [];
  let phone: string | null = null;
  const portalUrls: PortalLink[] = [];
  const emails: string[] = [];
  const extraLines: string[] = [];
  let seenBlankAfterAddress = false;

  for (const raw of lines) {
    const line = raw.trim();
    const emailMatch = line.match(EMAIL_RE);
    const labeledUrl = line.match(LABELED_URL);
    const bareUrl = line.match(/^(https?:\/\/|www\.)\S+$/i);

    if (!seenBlankAfterAddress) {
      if (!line) {
        seenBlankAfterAddress = address.length > 0;
        continue;
      }
      const phoneMatch = line.match(PHONE_RE);
      if (phoneMatch && !/https?:|www\./i.test(line)) {
        phone = phoneMatch[1];
        if (line !== phoneMatch[1]) address.push(line);
        continue;
      }
      if (bareUrl) {
        portalUrls.push({ label: "Portal", url: normalizeUrl(line) });
        continue;
      }
      if (labeledUrl) {
        portalUrls.push({ label: labeledUrl[1].trim(), url: normalizeUrl(labeledUrl[2]) });
        continue;
      }
      if (emailMatch && line === emailMatch[0]) {
        emails.push(emailMatch[0]);
        continue;
      }
      address.push(line);
      continue;
    }

    if (labeledUrl) {
      portalUrls.push({ label: labeledUrl[1].trim(), url: normalizeUrl(labeledUrl[2]) });
      continue;
    }
    if (bareUrl) {
      portalUrls.push({ label: "Link", url: normalizeUrl(line) });
      continue;
    }
    if (emailMatch && !line.includes(" ")) {
      emails.push(emailMatch[0]);
      continue;
    }
    extraLines.push(raw);
  }

  return {
    address,
    phone,
    emails,
    portalUrls,
    extra: extraLines.join("\n").trim(),
  };
}

export function linkify(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const re = new RegExp(`${URL_RE.source}|${EMAIL_RE.source}`, "gi");
  let last = 0;
  let m: RegExpExecArray | null;
  let idx = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const token = m[0];
    if (token.includes("@") && !token.includes("://")) {
      parts.push(
        createElement(
          "a",
          {
            key: `e-${idx++}`,
            href: `mailto:${token}`,
            className: "text-primary underline underline-offset-2 hover:text-primary/80",
          },
          token,
        ),
      );
    } else {
      const href = normalizeUrl(token);
      parts.push(
        createElement(
          "a",
          {
            key: `u-${idx++}`,
            href,
            target: "_blank",
            rel: "noopener noreferrer",
            className: "break-all text-primary underline underline-offset-2 hover:text-primary/80",
          },
          token,
        ),
      );
    }
    last = m.index + token.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}