"use client";

import { useState } from "react";
import { Calendar } from "lucide-react";
import { Button } from "./ui";

interface SendLaterPopoverProps {
  onCancel: () => void;
  onDone: (date: Date) => void;
}

function addDaysAtTime(daysFromNow: number, hour?: number, minute?: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  if (hour !== undefined) d.setHours(hour, minute ?? 0, 0, 0);
  return d;
}

const PRESETS: { label: string; getDate: () => Date }[] = [
  { label: "Tomorrow", getDate: () => addDaysAtTime(1) },
  { label: "Tomorrow, 10:00 AM", getDate: () => addDaysAtTime(1, 10, 0) },
  { label: "Tomorrow, 11:00 AM", getDate: () => addDaysAtTime(1, 11, 0) },
  { label: "Tomorrow, 3:00 PM", getDate: () => addDaysAtTime(1, 15, 0) },
];

function toLocalDatetimeInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function SendLaterPopover({ onCancel, onDone }: SendLaterPopoverProps) {
  const [selected, setSelected] = useState<Date | null>(null);
  const [customValue, setCustomValue] = useState("");

  return (
    <div className="absolute right-0 top-[calc(100%+8px)] z-20 w-72 rounded-xl border border-ink-200 bg-white p-4 shadow-popover">
      <div className="mb-3 text-sm font-semibold text-ink-900">Send Later</div>

      <label className="relative mb-3 block">
        <input
          type="datetime-local"
          value={customValue}
          onChange={(e) => {
            setCustomValue(e.target.value);
            setSelected(e.target.value ? new Date(e.target.value) : null);
          }}
          className="w-full rounded-lg border border-ink-200 bg-ink-50 py-2 pl-3 pr-9 text-sm text-ink-900 focus:border-brand-500 focus:bg-white"
          placeholder="Pick date & time"
        />
        <Calendar size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-500" />
      </label>

      <div className="mb-4 flex flex-col">
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            onClick={() => {
              const date = preset.getDate();
              setSelected(date);
              setCustomValue(toLocalDatetimeInputValue(date));
            }}
            className="rounded-md px-2 py-2 text-left text-sm text-ink-700 hover:bg-ink-50"
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          size="sm"
          disabled={!selected}
          onClick={() => selected && onDone(selected)}
        >
          Done
        </Button>
      </div>
    </div>
  );
}
