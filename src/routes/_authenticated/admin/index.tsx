import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckSquare, Contact, DollarSign, Download, Loader2, Music, Wallet } from "lucide-react";

import { adminListCustomerActivity } from "@/lib/admin-activity.functions";
import { adminListCrm } from "@/lib/crm.functions";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader, SectionTitle, StatTile, Surface } from "@/components/admin/ui";
import { RevenueChart, buildDailyRevenue } from "@/components/admin/revenue-chart";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminOverview,
});

const money = (c: number) => `$${(c / 100).toFixed(2)}`;
const DAY = 86_400_000;

function AdminOverview() {
  const [view, setView] = useState("followups");
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const panels = ["followups", "revenue", "activity"];
  const changePanel = (step: number) =>
    setView((current) => panels[(panels.indexOf(current) + step + panels.length) % panels.length]);
  const fetchActivity = useServerFn(adminListCustomerActivity);
  const fetchCrm = useServerFn(adminListCrm);

  const activityQ = useQuery({ queryKey: ["admin-customer-activity"], queryFn: () => fetchActivity() });
  const crmQ = useQuery({ queryKey: ["admin-crm"], queryFn: () => fetchCrm() });

  const stats = useMemo(() => {
    const rows = activityQ.data?.rows ?? [];
    const since = Date.now() - 30 * DAY;
    const recent = rows.filter((r) => new Date(r.created_at).getTime() >= since);
    const paid = recent.filter((r) => r.kind === "purchase" && r.paid);
    const pending = recent.filter((r) => r.kind === "purchase" && !r.paid);
    const downloads = recent.filter((r) => r.kind !== "purchase");
    return {
      revenue: paid.reduce((s, r) => s + (r.amount_cents ?? 0), 0),
      paidCount: paid.length,
      pendingCount: pending.length,
      downloads: downloads.length,
      newLeads: recent.filter((r) => r.kind === "free_download").length,
      recent: rows.slice(0, 8),
    };
  }, [activityQ.data]);

  const followUps = useMemo(() => {
    const tasks = (crmQ.data?.tasks ?? [])
      .filter((t) => t.status === "open")
      .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    return {
      overdue: tasks.filter((t) => t.due_date && t.due_date < today),
      today: tasks.filter((t) => t.due_date === today),
      open: tasks.length,
    };
  }, [crmQ.data]);

  const prospects = crmQ.data?.prospects ?? [];
  const loading = activityQ.isLoading || crmQ.isLoading;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex shrink-0 items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Workspace · last 30 days
          </p>
          <h1 className="text-xl font-bold sm:text-2xl">Today</h1>
        </div>
        <div className="flex gap-2">
          <Button asChild size="sm" variant="outline">
            <Link to="/admin/customers">Add prospect</Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/admin/tasks">New task</Link>
          </Button>
        </div>
      </div>
      <div className="grid shrink-0 grid-cols-2 gap-2 lg:grid-cols-4">
        {[
          { label: "Paid revenue", value: money(stats.revenue), note: "Confirmed payments" },
          { label: "Paid sales", value: stats.paidCount, note: stats.pendingCount + " unpaid checkouts" },
          { label: "Downloads", value: stats.downloads, note: "Last 30 days" },
          { label: "Free download requests", value: stats.newLeads, note: "Last 30 days · may include repeats" },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-border bg-card px-3 py-2">
            <div className="text-[11px] text-muted-foreground">{item.label}</div>
            <div className="text-xl font-bold tabular-nums">{loading ? "—" : item.value}</div>
            <div className="text-[10px] text-muted-foreground">{item.note}</div>
          </div>
        ))}
      </div>
      <div
        className="grid shrink-0 grid-cols-3 gap-1 rounded-xl bg-secondary/50 p-1"
        role="tablist"
        aria-label="Overview panels"
      >
        {[
          { id: "followups", label: "Focus today", count: followUps.overdue.length + followUps.today.length },
          { id: "revenue", label: "Revenue" },
          { id: "activity", label: "Activity" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={"overview-tab-" + tab.id}
            aria-selected={view === tab.id}
            tabIndex={view === tab.id ? 0 : -1}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
                event.preventDefault();
                const next =
                  panels[
                    (panels.indexOf(view) + (event.key === "ArrowRight" ? 1 : -1) + panels.length) % panels.length
                  ];
                setView(next);
                document.getElementById("overview-tab-" + next)?.focus();
              }
            }}
            aria-controls={"overview-panel-" + tab.id}
            onClick={() => setView(tab.id)}
            className={
              "min-h-11 rounded-lg px-2 text-xs font-semibold transition-colors " +
              (view === tab.id ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground")
            }
          >
            {tab.label}
            {tab.count ? " (" + tab.count + ")" : ""}
          </button>
        ))}
      </div>
      <section
        onTouchStart={(event) => {
          const touch = event.touches[0];
          touchStart.current = { x: touch.clientX, y: touch.clientY };
        }}
        onTouchEnd={(event) => {
          const start = touchStart.current;
          touchStart.current = null;
          if (!start) return;
          const touch = event.changedTouches[0];
          const dx = touch.clientX - start.x;
          const dy = touch.clientY - start.y;
          if (
            Math.abs(dx) > 70 &&
            Math.abs(dx) > Math.abs(dy) * 2 &&
            !(event.target as HTMLElement).closest("button, a, input, select, textarea, svg")
          )
            changePanel(dx < 0 ? 1 : -1);
        }}
        role="tabpanel"
        id={"overview-panel-" + view}
        aria-labelledby={"overview-tab-" + view}
        tabIndex={0}
        className="min-h-0 flex-1 overflow-auto overscroll-contain rounded-xl border border-border bg-card p-3 sm:p-4"
      >
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : activityQ.isError || crmQ.isError ? (
          <div className="space-y-3">
            <p>Some dashboard data could not be loaded.</p>
            <Button
              size="sm"
              onClick={() => {
                void activityQ.refetch();
                void crmQ.refetch();
              }}
            >
              Retry
            </Button>
          </div>
        ) : (
          <>
            {view === "revenue" && (
              <>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-semibold">Revenue</h2>
                  <span className="text-[10px] text-muted-foreground">Paid purchases only</span>
                </div>
                <RevenueChart data={buildDailyRevenue(activityQ.data?.rows ?? [])} />
              </>
            )}
            {view === "followups" && (
              <>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-semibold">Your next 5 follow-ups</h2>
                  <Link to="/admin/tasks" className="text-xs text-primary">
                    All tasks →
                  </Link>
                </div>
                {followUps.open === 0 ? (
                  <EmptyState
                    title="No open tasks"
                    description="Add a task to track calls, quotes and custom work."
                    action={
                      <Button asChild size="sm" className="mt-2">
                        <Link to="/admin/tasks">Create a task</Link>
                      </Button>
                    }
                  />
                ) : (
                  <ul className="space-y-2">
                    {[...followUps.overdue, ...followUps.today].slice(0, 5).map((t) => (
                      <li
                        key={t.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
                      >
                        <Link
                          to="/admin/tasks"
                          className="min-w-0 truncate text-sm font-medium text-primary hover:underline"
                        >
                          {t.title}
                        </Link>
                        <span className="shrink-0 text-xs text-muted-foreground">{t.due_date}</span>
                      </li>
                    ))}
                    {followUps.overdue.length + followUps.today.length === 0 && (
                      <li className="text-sm text-muted-foreground">
                        Nothing due today. {followUps.open} tasks scheduled later.
                      </li>
                    )}
                  </ul>
                )}
              </>
            )}
            {view === "activity" && (
              <>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-semibold">Recent activity</h2>
                  <Link to="/admin/sales" className="text-xs text-primary">
                    All activity →
                  </Link>
                </div>
                {stats.recent.length === 0 ? (
                  <EmptyState title="No activity yet" description="Sales and downloads appear here as they happen." />
                ) : (
                  <ul className="divide-y divide-border">
                    {stats.recent.map((r) => (
                      <li key={r.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{r.beat_title}</div>
                          <div className="truncate text-xs text-muted-foreground">
                            {r.name ?? r.email ?? "Unknown customer"}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm tabular-nums">
                            {r.kind === "purchase" ? (r.paid ? money(r.amount_cents ?? 0) : "Unpaid") : "Download"}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {new Date(r.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </>
        )}
      </section>
    </div>
  );
}
