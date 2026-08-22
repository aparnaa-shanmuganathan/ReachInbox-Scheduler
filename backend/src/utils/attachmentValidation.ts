import { ApiError } from "../middleware/errorHandler";

// Mirrors the extension denylist most webmail providers (Gmail included) apply: block
// directly-executable formats, allow everything else — images, video, PDFs, office docs,
// archives, etc. all pass through untouched.
const BLOCKED_EXTENSIONS = new Set([
  "exe", "msi", "bat", "cmd", "com", "scr", "pif", "vbs", "vbe", "js", "jse",
  "wsf", "wsh", "ps1", "psm1", "sh", "app", "jar", "apk", "dmg",
]);

export function assertAttachmentAllowed(filename: string): void {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext && BLOCKED_EXTENSIONS.has(ext)) {
    throw new ApiError(400, `Attachment type ".${ext}" is not allowed for security reasons: ${filename}`);
  }
}
