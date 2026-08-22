"use client";

import { format } from "date-fns";
import { RefreshCw, Search, SlidersHorizontal } from "lucide-react";
import type { EmailRow } from "@/types";
import { StatusPill } from "./ui";
import { EmptyState, LoadingState } from "./States";

interface EmailListPaneProps {
  rows: EmailRow[];
  isLoading: boolean;
  mode: "scheduled" | "sent";
  onRefresh: () => void;
}

// The body is stored as the HTML the compose editor produced — strip tags and collapse
// whitespace to get a Gmail-style plain-text snippet for the list row.
function bodySnippet(html: string, maxLength = 90): string {
  const text = html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}

export function EmailListPane({ rows, isLoading, mode, onRefresh }: EmailListPaneProps) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center gap-3 border-b border-ink-200 px-8 py-4">
        <div className="relative flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
          <input
            placeholder="Search"
            className="w-full rounded-lg border border-ink-200 bg-ink-50 py-2 pl-9 pr-3 text-sm text-ink-900 placeholder:text-ink-500 focus:border-brand-500 focus:bg-white"
          />
        </div>
        <button className="rounded-lg border border-ink-200 p-2 text-ink-500 hover:bg-ink-50">
          <SlidersHorizontal size={15} />
        </button>
        <button
          onClick={onRefresh}
          className="rounded-lg border border-ink-200 p-2 text-ink-500 hover:bg-ink-50"
          title="Refresh"
        >
          <RefreshCw size={15} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <LoadingState />
        ) : rows.length === 0 ? (
          mode === "scheduled" ? (
            <EmptyState
              title="Nothing scheduled yet"
              hint="Compose a new email to add recipients to the send queue."
            />
          ) : (
            <EmptyState
              title="No emails sent yet"
              hint="Delivered and failed emails will show up here once the scheduler runs."
            />
          )
        ) : (
          <ul>
            {rows.map((row) => (
              <li
                key={row.id}
                className="flex items-center gap-4 border-b border-ink-100 px-8 py-4 hover:bg-ink-50"
              >
                <span className="w-48 shrink-0 truncate text-sm text-ink-900">
                  To: {row.recipient}
                </span>

                {mode === "scheduled" ? (
                  <span className="flex shrink-0 items-center gap-1 rounded-md bg-scheduled-bg px-2 py-1 text-xs font-medium text-scheduled-text">
                    {format(new Date(row.scheduledFor), "EEE h:mm:ss a")}
                  </span>
                ) : (
                  <StatusPill status={row.status} />
                )}

                <span className="min-w-0 flex-1 truncate text-sm">
                  <span className="font-medium text-ink-900">{row.subject}</span>
                  {row.body && (
                    <span className="text-ink-500"> — {bodySnippet(row.body)}</span>
                  )}
                </span>

                {mode === "scheduled" && row.status === "RATE_LIMITED" && (
                  <StatusPill status={row.status} />
                )}
                {mode === "sent" && row.status === "FAILED" && row.lastError && (
                  <span className="max-w-[160px] shrink-0 truncate text-xs text-failed-text" title={row.lastError}>
                    {row.lastError}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
