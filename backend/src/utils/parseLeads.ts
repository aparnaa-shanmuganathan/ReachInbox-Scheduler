const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

/**
 * Extracts unique, valid email addresses from an uploaded CSV/TXT lead file.
 * Deliberately regex-scans the whole buffer rather than assuming a fixed column layout —
 * works for a single-column list, a multi-column CSV with a header row, or a raw text
 * paste, which is what "upload a CSV/text file of email leads" implies in practice.
 */
export function parseRecipientsFromBuffer(buffer: Buffer): string[] {
  const text = buffer.toString("utf-8");
  const matches = text.match(EMAIL_REGEX) ?? [];
  const unique = Array.from(new Set(matches.map((email) => email.trim().toLowerCase())));
  return unique;
}
