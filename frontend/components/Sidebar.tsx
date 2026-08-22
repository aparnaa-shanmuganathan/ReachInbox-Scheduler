"use client";

import { useState } from "react";
import { Clock, Send, ChevronDown, LogOut, Plus } from "lucide-react";
import { clsx } from "clsx";
import { useAuth } from "@/lib/auth";
import { Button, Wordmark } from "./ui";

export type Tab = "scheduled" | "sent";

interface SidebarProps {
  tab: Tab;
  onTabChange: (tab: Tab) => void;
  scheduledCount: number;
  sentCount: number;
  onCompose: () => void;
}

export function Sidebar({ tab, onTabChange, scheduledCount, sentCount, onCompose }: SidebarProps) {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <aside className="flex h-screen w-72 shrink-0 flex-col border-r border-ink-200 px-5 py-6">
      <Wordmark className="mb-6 px-1" />

      {user && (
        <div className="relative mb-4">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex w-full items-center gap-2.5 rounded-xl border border-ink-200 px-3 py-2.5 text-left hover:bg-ink-50"
          >
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatarUrl} alt="" className="h-8 w-8 rounded-full" />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-sm font-medium text-brand-700">
                {user.name.slice(0, 1)}
              </div>
            )}
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-sm font-medium text-ink-900">{user.name}</div>
              <div className="truncate text-xs text-ink-500">{user.email}</div>
            </div>
            <ChevronDown size={15} className="text-ink-500" />
          </button>

          {menuOpen && (
            <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-10 rounded-lg border border-ink-200 bg-white p-1 shadow-popover">
              <button
                onClick={logout}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm text-ink-700 hover:bg-ink-50"
              >
                <LogOut size={14} />
                Log out
              </button>
            </div>
          )}
        </div>
      )}

      <Button onClick={onCompose} className="mb-6 w-full">
        <Plus size={15} />
        Compose
      </Button>

      <div className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-ink-500">
        Core
      </div>
      <nav className="flex flex-col gap-1">
        <NavItem
          icon={<Clock size={16} />}
          label="Scheduled"
          count={scheduledCount}
          active={tab === "scheduled"}
          onClick={() => onTabChange("scheduled")}
        />
        <NavItem
          icon={<Send size={16} />}
          label="Sent"
          count={sentCount}
          active={tab === "sent"}
          onClick={() => onTabChange("sent")}
        />
      </nav>
    </aside>
  );
}

function NavItem({
  icon,
  label,
  count,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
        active ? "bg-brand-50 text-brand-700 font-medium" : "text-ink-700 hover:bg-ink-50",
      )}
    >
      <span className={active ? "text-brand-600" : "text-ink-500"}>{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      <span className={clsx("font-mono text-xs tabular-nums", active ? "text-brand-700" : "text-ink-500")}>
        {count}
      </span>
    </button>
  );
}
