"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { ArrowLeft, Clock, File as FileIcon, Paperclip, Upload, X, AlertCircle, ChevronDown } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";
import { Button } from "./ui";
import { RichTextEditor } from "./RichTextEditor";
import { SendLaterPopover } from "./SendLaterPopover";

interface ComposePaneProps {
  onBack: () => void;
  onScheduled: () => void;
  senderEmails: string[];
}

const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
// Matches the backend's multer limit — sized to fit short video clips, not just images.
const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024;
const MAX_ATTACHMENTS = 10;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ComposePane({ onBack, onScheduled, senderEmails }: ComposePaneProps) {
  const { token } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);

  const [recipients, setRecipients] = useState<string[]>([]);
  const [toInput, setToInput] = useState("");
  const [leadsFile, setLeadsFile] = useState<File | null>(null);
  const [showAllChips, setShowAllChips] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const previewUrlsRef = useRef<Map<File, string>>(new Map());

  function getPreviewUrl(file: File): string {
    let url = previewUrlsRef.current.get(file);
    if (!url) {
      url = URL.createObjectURL(file);
      previewUrlsRef.current.set(file, url);
    }
    return url;
  }

  useEffect(() => {
    const urls = previewUrlsRef.current;
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [delaySeconds, setDelaySeconds] = useState(2);
  const [hourlyLimit, setHourlyLimit] = useState(200);

  const [sendLaterOpen, setSendLaterOpen] = useState(false);
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addRecipientFromInput() {
    const candidates = toInput.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
    const valid = candidates.filter((c) => EMAIL_RE.test(c));
    if (valid.length > 0) {
      setRecipients((prev) => Array.from(new Set([...prev, ...valid])));
    }
    setToInput("");
  }

  async function handleFileSelect(file: File | null) {
    if (!file) return;
    setLeadsFile(file);
    const text = await file.text();
    const matches = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) ?? [];
    const unique = Array.from(new Set(matches.map((m) => m.toLowerCase())));
    setRecipients((prev) => Array.from(new Set([...prev, ...unique])));
  }

  function removeRecipient(email: string) {
    setRecipients((prev) => prev.filter((r) => r !== email));
  }

  function addAttachments(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    const incoming = Array.from(files);
    const oversized = incoming.find((f) => f.size > MAX_ATTACHMENT_BYTES);
    if (oversized) {
      setError(`"${oversized.name}" is over the 50MB attachment limit.`);
      return;
    }
    setAttachments((prev) => {
      const combined = [...prev, ...incoming];
      if (combined.length > MAX_ATTACHMENTS) {
        setError(`You can attach up to ${MAX_ATTACHMENTS} files.`);
        return prev;
      }
      return combined;
    });
  }

  function removeAttachment(index: number) {
    setAttachments((prev) => {
      const removed = prev[index];
      const url = previewUrlsRef.current.get(removed);
      if (url) {
        URL.revokeObjectURL(url);
        previewUrlsRef.current.delete(removed);
      }
      return prev.filter((_, i) => i !== index);
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!token) return;
    if (recipients.length === 0) {
      setError("Add at least one recipient — type an email and press Enter, or upload a list.");
      return;
    }
    if (!subject.trim() || !body.trim()) {
      setError("Subject and body are required.");
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("subject", subject);
      formData.append("body", body);
      formData.append("startTime", (scheduledAt ?? new Date()).toISOString());
      formData.append("delayBetweenEmailsMs", String(delaySeconds * 1000));
      formData.append("hourlyLimitPerSender", String(hourlyLimit));
      formData.append("recipients", JSON.stringify(recipients));
      if (leadsFile) formData.append("leadsFile", leadsFile);
      for (const file of attachments) formData.append("attachments", file);

      await api.scheduleCampaign(token, formData);
      onScheduled();
      onBack();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to schedule campaign.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const visibleChips = showAllChips ? recipients : recipients.slice(0, 3);
  const overflowCount = recipients.length - visibleChips.length;

  return (
    <form onSubmit={handleSubmit} className="flex flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-ink-200 px-8 py-4">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onBack} className="rounded-md p-1 text-ink-500 hover:bg-ink-100">
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-base font-semibold text-ink-900">Compose New Email</h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => attachmentInputRef.current?.click()}
            title="Attach files"
            className="relative rounded-lg p-2 text-ink-500 hover:bg-ink-100"
          >
            <Paperclip size={16} />
            {attachments.length > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-brand-500 text-[10px] font-medium text-white">
                {attachments.length}
              </span>
            )}
          </button>
          <input
            ref={attachmentInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              addAttachments(e.target.files);
              e.target.value = "";
            }}
          />
          <div className="relative">
            <button
              type="button"
              onClick={() => setSendLaterOpen((v) => !v)}
              className="rounded-lg p-2 text-ink-500 hover:bg-ink-100"
              title="Schedule for later"
            >
              <Clock size={16} />
            </button>
            {sendLaterOpen && (
              <SendLaterPopover
                onCancel={() => setSendLaterOpen(false)}
                onDone={(date) => {
                  setScheduledAt(date);
                  setSendLaterOpen(false);
                }}
              />
            )}
          </div>
          <Button type="submit" variant={scheduledAt ? "outline" : "solid"} disabled={isSubmitting}>
            {isSubmitting ? "Scheduling…" : scheduledAt ? "Send Later" : "Send"}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="mx-auto max-w-3xl space-y-4">
          <FieldRow label="From">
            {senderEmails.length > 0 ? (
              <div className="relative">
                <select className="field-input appearance-none pr-9" defaultValue={senderEmails[0]}>
                  {senderEmails.map((email) => (
                    <option key={email} value={email}>
                      {email}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-500" />
              </div>
            ) : (
              <div className="field-input text-ink-500">Senders load automatically at first send</div>
            )}
          </FieldRow>

          <FieldRow label="To" trailing={
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700"
            >
              <Upload size={14} />
              Upload List
            </button>
          }>
            <div className="field-input flex min-h-[42px] flex-wrap items-center gap-1.5 py-1.5">
              {visibleChips.map((email) => (
                <span
                  key={email}
                  className="group flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs text-brand-700"
                >
                  {email}
                  <button type="button" onClick={() => removeRecipient(email)} className="hidden group-hover:block">
                    <X size={11} />
                  </button>
                </span>
              ))}
              {overflowCount > 0 && (
                <button
                  type="button"
                  onClick={() => setShowAllChips(true)}
                  className="rounded-full bg-ink-100 px-2.5 py-1 text-xs text-ink-700"
                >
                  +{overflowCount}
                </button>
              )}
              <input
                value={toInput}
                onChange={(e) => setToInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    addRecipientFromInput();
                  }
                }}
                onBlur={addRecipientFromInput}
                placeholder={recipients.length === 0 ? "recipient@example.com" : ""}
                className="min-w-[160px] flex-1 bg-transparent text-sm text-ink-900 outline-none placeholder:text-ink-500"
              />
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt"
              className="hidden"
              onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null)}
            />
          </FieldRow>

          <FieldRow label="Subject">
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
              className="field-input"
            />
          </FieldRow>

          <div className="flex gap-6">
            <FieldRow label="Delay between 2 emails (seconds)" className="flex-1">
              <input
                type="number"
                min={0}
                value={delaySeconds}
                onChange={(e) => setDelaySeconds(Number(e.target.value))}
                className="field-input"
              />
            </FieldRow>
            <FieldRow label="Hourly Limit" className="flex-1">
              <input
                type="number"
                min={1}
                value={hourlyLimit}
                onChange={(e) => setHourlyLimit(Number(e.target.value))}
                className="field-input"
              />
            </FieldRow>
          </div>

          <FieldRow label="Body">
            <RichTextEditor html={body} onChange={setBody} placeholder="Type Your Reply..." />
          </FieldRow>

          {attachments.length > 0 && (
            <ul className="flex flex-wrap gap-3">
              {attachments.map((file, index) => {
                const isImage = file.type.startsWith("image/");
                const isVideo = file.type.startsWith("video/");

                if (isImage || isVideo) {
                  const url = getPreviewUrl(file);
                  return (
                    <li
                      key={`${file.name}-${index}`}
                      className="group relative h-28 w-28 shrink-0 overflow-hidden rounded-lg border border-ink-200 bg-ink-100"
                    >
                      {isImage ? (
                        <img src={url} alt={file.name} className="h-full w-full object-cover" />
                      ) : (
                        <video src={url} muted className="h-full w-full object-cover" />
                      )}
                      <span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-1.5 py-0.5 text-[10px] text-white">
                        {file.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeAttachment(index)}
                        className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                        title="Remove attachment"
                      >
                        <X size={12} />
                      </button>
                    </li>
                  );
                }

                return (
                  <li
                    key={`${file.name}-${index}`}
                    className="group flex items-center gap-2 rounded-lg border border-ink-200 bg-ink-50 px-2.5 py-1.5 text-xs text-ink-700"
                  >
                    <FileIcon size={13} className="shrink-0 text-ink-500" />
                    <span className="max-w-[160px] truncate">{file.name}</span>
                    <span className="shrink-0 text-ink-500">{formatFileSize(file.size)}</span>
                    <button
                      type="button"
                      onClick={() => removeAttachment(index)}
                      className="shrink-0 rounded p-0.5 text-ink-500 hover:bg-ink-200 hover:text-ink-900"
                      title="Remove attachment"
                    >
                      <X size={12} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {scheduledAt && (
            <p className="text-xs text-ink-500">
              Scheduled to start {scheduledAt.toLocaleString()}.
            </p>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-failed-text/20 bg-failed-bg px-3 py-2.5 text-xs text-failed-text">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              {error}
            </div>
          )}
        </div>
      </div>
    </form>
  );
}

function FieldRow({
  label,
  children,
  trailing,
  className,
}: {
  label: string;
  children: React.ReactNode;
  trailing?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="field-label">{label}</span>
        {trailing}
      </div>
      {children}
    </div>
  );
}
