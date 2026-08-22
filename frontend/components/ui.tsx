import { clsx } from "clsx";
import type { ButtonHTMLAttributes } from "react";
import type { EmailStatus } from "@/types";

export function Button({
  className,
  variant = "solid",
  size = "md",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "solid" | "outline" | "ghost" | "google";
  size?: "md" | "sm";
}) {
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        size === "md" ? "px-4 py-2.5 text-sm" : "px-3 py-1.5 text-xs",
        variant === "solid" && "bg-brand-600 text-white hover:bg-brand-700",
        variant === "outline" &&
          "border border-brand-600 text-brand-700 bg-white hover:bg-brand-50",
        variant === "ghost" && "text-ink-500 hover:bg-ink-100 hover:text-ink-900",
        variant === "google" && "bg-brand-50 text-ink-900 hover:bg-brand-100",
        className,
      )}
      {...props}
    />
  );
}

const STATUS_CONFIG: Record<EmailStatus, { label: string; bg: string; text: string }> = {
  PENDING: { label: "Queued", bg: "bg-scheduled-bg", text: "text-scheduled-text" },
  QUEUED: { label: "Scheduled", bg: "bg-scheduled-bg", text: "text-scheduled-text" },
  PROCESSING: { label: "Sending", bg: "bg-processing-bg", text: "text-processing-text" },
  RATE_LIMITED: { label: "Throttled", bg: "bg-throttled-bg", text: "text-throttled-text" },
  SENT: { label: "Sent", bg: "bg-sent-bg", text: "text-sent-text" },
  FAILED: { label: "Failed", bg: "bg-failed-bg", text: "text-failed-text" },
};

export function StatusPill({ status }: { status: EmailStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className={clsx(
        "inline-flex shrink-0 items-center rounded-md px-2 py-1 text-xs font-medium",
        cfg.bg,
        cfg.text,
      )}
    >
      {cfg.label}
    </span>
  );
}

/** Bold wordmark styled after the Figma logo treatment (tight, heavy, geometric). */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={clsx("font-sans text-xl font-extrabold tracking-tight text-ink-900", className)}>
      reach<span className="text-brand-600">inbox</span>
    </span>
  );
}
