"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import type { EmailRow } from "@/types";
import { Sidebar, type Tab } from "@/components/Sidebar";
import { EmailListPane } from "@/components/EmailListPane";
import { ComposePane } from "@/components/ComposePane";

type View = "list" | "compose";

export default function DashboardPage() {
  const { token, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [view, setView] = useState<View>("list");
  const [tab, setTab] = useState<Tab>("scheduled");
  const [scheduled, setScheduled] = useState<EmailRow[]>([]);
  const [scheduledTotal, setScheduledTotal] = useState(0);
  const [sent, setSent] = useState<EmailRow[]>([]);
  const [sentTotal, setSentTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [senderEmails, setSenderEmails] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    if (!token) return;
    const [scheduledRes, sentRes] = await Promise.all([
      api.getScheduledEmails(token),
      api.getSentEmails(token),
    ]);
    setScheduled(scheduledRes.items);
    setScheduledTotal(scheduledRes.total);
    setSent(sentRes.items);
    setSentTotal(sentRes.total);
    setIsLoading(false);
  }, [token]);

  useEffect(() => {
    if (!authLoading && !token) router.replace("/login");
  }, [authLoading, token, router]);

  useEffect(() => {
    if (!token) return;
    refresh();
    api.getSenders(token).then((res) => setSenderEmails(res.senders.map((s) => s.fromEmail)));
    // Poll so counts and rows reflect worker activity close to real time.
    const interval = setInterval(refresh, 4000);
    return () => clearInterval(interval);
  }, [token, refresh]);

  if (authLoading || !token) return null;

  return (
    <main className="flex h-screen">
      <Sidebar
        tab={tab}
        onTabChange={(next) => {
          setTab(next);
          setView("list");
        }}
        scheduledCount={scheduledTotal}
        sentCount={sentTotal}
        onCompose={() => setView("compose")}
      />

      {view === "compose" ? (
        <ComposePane
          onBack={() => setView("list")}
          onScheduled={refresh}
          senderEmails={senderEmails}
        />
      ) : (
        <EmailListPane
          rows={tab === "scheduled" ? scheduled : sent}
          isLoading={isLoading}
          mode={tab}
          onRefresh={refresh}
        />
      )}
    </main>
  );
}
