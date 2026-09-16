import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
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
    const tasks = (crmQ.data?.tasks ?? []).filter((t) => t.status === "open");
    const today = new Date().toISOString().slice(0, 10);
    return {
      overdue: tasks.filter((t) => t.due_date && t.due_date < today),
      today: tasks.filter((t) => t.due_date === today),
      open: tasks.length,
    };
  }, [crmQ.data]);

  const prospects = crmQ.data?.prospects ?? [];
  const loading = activityQ.isLoading || crmQ.isLoading;

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumb="Workspace"
        title="Overview"
        description="Confirmed revenue, prospects and follow-ups from the last 30 days."
        actions={
          <>
            <Button asChild size="sm" variant="outline">
              <Link to="/admin/customers">Add prospect</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/admin/tasks">New task</Link>
            </Button>
          </>
        }
      />

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile icon={DollarSign} label="Paid revenue" value={money(stats.revenue)} hint="Last 30 days, confirmed only" />
            <StatTile icon={Wallet} label="Paid sales" value={stats.paidCount} hint={`${stats.pendingCount} unpaid checkout${stats.pendingCount === 1 ? "" : "s"}`} />
            <StatTile icon={Download} label="Downloads" value={stats.downloads} hint="Last 30 days" />
            <StatTile icon={Contact} label="New prospects" value={stats.newLeads + prospects.length} hint={`${prospects.length} added by hand`} />
          </div>

          <Surface>
            <SectionTitle
              action={
                <span className="text-[11px] text-muted-foreground">
                  Confirmed payments only · last 30 days
                </span>
              }
            >
              Revenue
            </SectionTitle>
            <div className="px-2 pb-4 sm:px-4">
              <RevenueChart data={buildDailyRevenue(activityQ.data?.rows ?? [])} />
            </div>
          </Surface>

          <div className="grid gap-4 lg:grid-cols-2">
            <Surface>
              <SectionTitle
                action={
                  <Button asChild size="sm" variant="ghost">
                    <Link to="/admin/tasks">All tasks</Link>
                  </Button>
                }
              >
                Follow-ups
              </SectionTitle>
              <div className="px-4 pb-4">
                {followUps.open === 0 ? (
                  <EmptyState
                    title="No open tasks"
                    description="Add a task to keep track of calls, quotes and custom work."
                    action={
                      <Button asChild size="sm" className="mt-2">
                        <Link to="/admin/tasks">Create a task</Link>
                      </Button>
                    }
                  />
                ) : (
                  <ul className="space-y-2">
                    {[...followUps.overdue, ...followUps.today].slice(0, 6).map((t) => (
                      <li key={t.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2.5">
                        <span className="min-w-0 truncate text-sm">{t.title}</span>
                        <span className={t.due_date && t.due_date < new Date().toISOString().slice(0, 10) ? "shrink-0 text-xs font-semibold text-destructive" : "shrink-0 text-xs text-muted-foreground"}>
                          {t.due_date}
                        </span>
                      </li>
                    ))}
                    {followUps.overdue.length + followUps.today.length === 0 && (
                      <li className="rounded-lg border border-dashed border-border/70 px-3 py-4 text-center text-sm text-muted-foreground">
                        Nothing due today. {followUps.open} task{followUps.open === 1 ? "" : "s"} scheduled later.
                      </li>
                    )}
                  </ul>
                )}
              </div>
            </Surface>

            <Surface>
              <SectionTitle
                action={
                  <Button asChild size="sm" variant="ghost">
                    <Link to="/admin/sales">All activity</Link>
                  </Button>
                }
              >
                Recent activity
              </SectionTitle>
              <div className="px-4 pb-4">
                {stats.recent.length === 0 ? (
                  <EmptyState title="No activity yet" description="Sales and downloads will appear here as they happen." />
                ) : (
                  <ul className="divide-y divide-border/60">
                    {stats.recent.map((r) => (
                      <li key={r.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2.5">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{r.beat_title}</div>
                          <div className="truncate text-xs text-muted-foreground">{r.name ?? r.email ?? "Unknown customer"}</div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="text-sm tabular-nums">
                            {r.kind === "purchase" ? (r.paid ? money(r.amount_cents ?? 0) : "Unpaid") : "Download"}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {new Date(r.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Surface>
          </div>

          <Surface className="p-4">
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="outline">
                <Link to="/admin/beats"><Music className="mr-1.5 h-4 w-4" /> Manage beats</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link to="/admin/customers"><Contact className="mr-1.5 h-4 w-4" /> Customers &amp; leads</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link to="/admin/tasks"><CheckSquare className="mr-1.5 h-4 w-4" /> Tasks</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link to="/admin/sales"><Wallet className="mr-1.5 h-4 w-4" /> Sales &amp; downloads</Link>
              </Button>
            </div>
          </Surface>
        </>
      )}
    </div>
  );
}
