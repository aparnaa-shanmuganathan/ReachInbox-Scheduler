import { Inbox, Loader2 } from "lucide-react";

export function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-24 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-ink-100 text-ink-500">
        <Inbox size={18} />
      </div>
      <p className="text-sm font-medium text-ink-900">{title}</p>
      <p className="max-w-xs text-xs text-ink-500">{hint}</p>
    </div>
  );
}

export function LoadingState() {
  return (
    <div className="flex items-center justify-center gap-2 py-24 text-sm text-ink-500">
      <Loader2 size={16} className="animate-spin" />
      Loading…
    </div>
  );
}
