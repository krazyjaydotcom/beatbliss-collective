import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  BarChart3,
  MessageSquare,
  Users,
  ArrowLeft,
  Loader2,
  Music,
  Gift,
  Download,
  Eye,
  ShieldCheck,
  UserCheck,
  GraduationCap,
  Link2,
  Clock,
  PanelsTopLeft,
  Tag,
  FileText,
  Image as ImageIcon,
  Megaphone,
  Mail,
  Menu,
  Wallet,
  CheckSquare,
  Contact,
  LayoutGrid,
  X,
} from "lucide-react";

import { useIsAdmin } from "@/hooks/use-is-admin";
import { KrazyLogo } from "@/components/krazy-logo";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin - MYBEATCATALOG" }] }),
  component: AdminLayout,
});

type NavItem = { to: string; label: string; icon: React.ComponentType<{ className?: string }>; exact?: boolean };

export const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: "Workspace",
    items: [
      { to: "/admin", label: "Today", icon: BarChart3, exact: true },
      { to: "/admin/customers", label: "Customers", icon: Contact },
      { to: "/admin/tasks", label: "Tasks", icon: CheckSquare },
      { to: "/admin/beats", label: "Catalog", icon: Music },
      { to: "/admin/email", label: "Email", icon: Mail },

    ],
  },
  {
    title: "Catalog tools",
    items: [
      { to: "/admin/beat-landing", label: "Landing Pages", icon: Link2 },
      { to: "/admin/beat-requests", label: "Beat Requests", icon: Music },
      { to: "/admin/import", label: "Import Beats", icon: Download },
      { to: "/admin/tags", label: "Tags", icon: Tag },
    ],
  },
  {
    title: "Business",
    items: [
      { to: "/admin/sales", label: "Sales & Downloads", icon: Wallet },
      { to: "/admin/analytics", label: "Analytics", icon: BarChart3 },
      { to: "/admin/members", label: "Members", icon: Users },
      { to: "/admin/agreements", label: "Agreements", icon: FileText },
    ],
  },
  {
    title: "Marketing",
    items: [
      { to: "/admin/discounts", label: "Discount codes", icon: Tag },
      { to: "/admin/email-templates", label: "Email Templates", icon: Mail },
      { to: "/admin/invites", label: "Invites", icon: Link2 },
      { to: "/admin/funnels", label: "Offer Page", icon: PanelsTopLeft },
      { to: "/admin/seo-pages", label: "SEO Pages", icon: FileText },
      { to: "/admin/home-gallery", label: "Home Gallery", icon: ImageIcon },
      { to: "/admin/commercials", label: "Commercials", icon: Megaphone },
      { to: "/admin/audio-tag", label: "Audio Tag", icon: Tag },
    ],
  },
  {
    title: "Administration",
    items: [
      { to: "/admin/access-applications", label: "Access Applications", icon: UserCheck },
      { to: "/admin/access-questions", label: "Access Questions", icon: FileText },
      { to: "/admin/access", label: "Manual Access", icon: UserCheck },
      { to: "/admin/beat-claims", label: "Beat Claims", icon: Clock },
      { to: "/admin/classroom", label: "Classroom", icon: GraduationCap },
      { to: "/admin/whitelist", label: "Whitelist", icon: ShieldCheck },
      { to: "/admin/gift", label: "Gift Credits", icon: Gift },
      { to: "/admin/support", label: "Support", icon: MessageSquare },
      { to: "/admin/online", label: "Online Users", icon: Users },
      { to: "/beats", label: "View as User", icon: Eye },
    ],
  },
];

const MOBILE_NAV: NavItem[] = [
  { to: "/admin", label: "Today", icon: BarChart3, exact: true },
  { to: "/admin/customers", label: "Customers", icon: Contact },
  { to: "/admin/tasks", label: "Tasks", icon: CheckSquare },
  { to: "/admin/beats", label: "Catalog", icon: Music },
  { to: "/admin/email", label: "Email", icon: Mail },
];

function isActive(path: string, item: NavItem) {
  return item.exact ? path === item.to : path === item.to || path.startsWith(`${item.to}/`);
}

function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function NavLinkRow({ item, path, onNavigate }: { item: NavItem; path: string; onNavigate?: () => void }) {
  const active = isActive(path, item);
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
        active
          ? "bg-primary/15 text-primary ring-1 ring-inset ring-primary/30"
          : "text-muted-foreground hover:bg-secondary hover:text-foreground",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

function AdminLayout() {
  const isAdmin = useIsAdmin();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const now = useNow();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [recordsOpen, setRecordsOpen] = useState(false);
  const [navGroup, setNavGroup] = useState("");
  useEffect(() => {
    const group = NAV_GROUPS.find((g) => g.items.some((item) => isActive(path, item)));
    if (group && group.title !== "Workspace") setNavGroup(group.title);
  }, [path]);

  useEffect(() => {
    if (isAdmin === false) navigate({ to: "/beats" });
  }, [isAdmin, navigate]);

  useEffect(() => {
    setDrawerOpen(false);
  }, [path]);

  if (isAdmin !== true) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const dateStr = now.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const timeStr = now.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-background text-foreground">
      <header className="shrink-0 z-30 border-b border-border/60 bg-background/95 backdrop-blur">
        <div className="mx-auto grid max-w-[1500px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-2 sm:px-5">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="md:hidden flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground"
              aria-label="Open admin menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <Link
              to="/beats"
              className="hidden md:flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition hover:border-primary/50 hover:text-foreground"
              aria-label="Back to site"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <Link to="/" className="min-w-0">
              <KrazyLogo className="text-sm sm:text-base" />
            </Link>
            <Badge variant="outline" className="hidden border-primary/40 bg-primary/10 text-primary sm:inline-flex">
              ADMIN
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setRecordsOpen(true)}
              className="min-h-10 rounded-lg border border-border px-3 text-xs font-medium hover:bg-secondary"
            >
              Records &amp; Trash
            </button>
            <div className="hidden text-right sm:block">
              <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{dateStr}</div>
              <div className="text-sm font-semibold tabular-nums">{timeStr}</div>
            </div>
          </div>
        </div>
      </header>
      {recordsOpen && <RecordsWorkspace onClose={() => setRecordsOpen(false)} />}

      {drawerOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/70"
          role="dialog"
          aria-modal="true"
          aria-label="All admin destinations"
          onClick={() => setDrawerOpen(false)}
        >
          <aside
            className="absolute left-0 top-0 flex h-full w-[19rem] max-w-[88vw] flex-col border-r border-border bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
              <KrazyLogo className="text-base" />
              <button
                onClick={() => setDrawerOpen(false)}
                className="flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-3 pb-[env(safe-area-inset-bottom)]">
              {NAV_GROUPS.map((g) => (
                <div key={g.title} className="mb-4">
                  <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
                    {g.title}
                  </div>
                  <div className="space-y-0.5">
                    {g.items.map((item) => (
                      <NavLinkRow key={item.to} item={item} path={path} onNavigate={() => setDrawerOpen(false)} />
                    ))}
                  </div>
                </div>
              ))}
            </nav>
          </aside>
        </div>
      )}

      <div className="mx-auto grid w-full max-w-[1600px] min-h-0 flex-1 grid-cols-1 gap-3 overflow-hidden px-3 py-3 sm:px-5 md:grid-cols-[208px_minmax(0,1fr)]">
        <aside className="hidden min-h-0 overflow-y-auto overscroll-contain md:block">
          <nav className="space-y-2 pr-1" aria-label="Admin sections">
            <label className="mb-3 block">
              <span className="mb-1 block px-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Jump to
              </span>
              <select
                aria-label="Jump to admin page"
                value={NAV_GROUPS.flatMap((g) => g.items).some((i) => i.to === path) ? path : "/admin"}
                onChange={(e) => navigate({ to: e.target.value })}
                className="h-11 w-full rounded-lg border border-border bg-card px-2 text-xs"
              >
                {NAV_GROUPS.map((g) => (
                  <optgroup key={g.title} label={g.title}>
                    {g.items.map((i) => (
                      <option key={i.to} value={i.to}>
                        {i.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            {NAV_GROUPS.map((g) =>
              g.title === "Workspace" ? (
                <div key={g.title} className="space-y-1 border-b border-border/60 pb-3">
                  {g.items.map((item) => (
                    <NavLinkRow key={item.to} item={item} path={path} />
                  ))}
                  <p className="px-3 pt-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    More tools
                  </p>
                </div>
              ) : (
                <div key={g.title} className="rounded-xl border border-border/60 bg-card/40">
                  <button
                    type="button"
                    aria-expanded={navGroup === g.title}
                    aria-controls={"admin-nav-" + g.title}
                    onClick={() => setNavGroup(navGroup === g.title ? "" : g.title)}
                    className="flex min-h-11 w-full items-center justify-between px-3 text-xs font-semibold"
                  >
                    <span>{g.title}</span>
                    <span aria-hidden="true" className="text-muted-foreground">
                      {navGroup === g.title ? "−" : "+"}
                    </span>
                  </button>
                  <div id={"admin-nav-" + g.title} hidden={navGroup !== g.title} className="space-y-0.5 px-1 pb-1">
                    {g.items.map((item) => (
                      <NavLinkRow key={item.to} item={item} path={path} />
                    ))}
                  </div>
                </div>
              ),
            )}
          </nav>
        </aside>

        <main
          key={path}
          className={cn(
            "min-h-0 min-w-0 max-w-full overscroll-contain",
            path === "/admin" || path === "/admin/" || path === "/admin/beat-landing"
              ? "overflow-hidden"
              : "overflow-y-auto",
          )}
        >
          <Outlet />
        </main>
      </div>

      <nav
        className="md:hidden shrink-0 z-40 border-t border-border/70 bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
        aria-label="Primary"
      >
        <div className="grid grid-cols-6">
          {MOBILE_NAV.map((item) => {
            const active = isActive(path, item);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex min-h-[3.25rem] flex-col items-center justify-center gap-1 text-[10px] font-medium",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="flex min-h-[3.25rem] flex-col items-center justify-center gap-1 text-[10px] font-medium text-muted-foreground"
            aria-label="More destinations"
          >
            <LayoutGrid className="h-5 w-5" />
            More
          </button>
        </div>
      </nav>
    </div>
  );
}

const RECORD_TYPES = [
  ["lease_orders", "Purchases"],
  ["beat_lead_captures", "Free downloads"],
  ["downloads", "Member downloads"],
  ["crm_prospects", "Manual prospects"],
  ["crm_tasks", "Tasks"],
  ["beat_landing_inquiries", "Beat inquiries"],
  ["beat_requests", "Beat requests"],
  ["beat_claims", "Beat claims"],
  ["access_applications", "Access applications"],
  ["beat_funnel_leads", "Funnel leads"],
  ["agreements", "Member agreements"],
  ["purchase_licenses", "Purchased licenses"],
  ["admin_email_drafts", "Email drafts"],
  ["invites", "Invites"],
  ["whitelist_submissions", "Whitelist submissions"],
  ["chat_messages", "Support messages"],
  ["chat_threads", "Support conversations"],
  ["notes", "Notes"],
  ["notifications", "Notifications"],
  ["transactions", "Credit transactions"],
  ["exclusive_requests", "Exclusive rights requests"],
  ["exclusive_bids", "Bids"],
  ["beat_plays", "Beat plays"],
  ["ad_events", "Ad events"],
  ["purchase_funnel_events", "Funnel events"],
  ["email_send_log", "Email delivery logs"],
] as const;
type ManagedRecord = {
  id: string;
  record_id: string;
  date: string;
  label: string;
  email: string | null;
  status: string | null;
  amount_cents: number | null;
};
function RecordsWorkspace({ onClose }: { onClose: () => void }) {
  const [table, setTable] = useState<string>("lease_orders");
  const [trash, setTrash] = useState(false);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [pending, setPending] = useState<{ action: "delete" | "restore" | "purge"; rows: ManagedRecord[] } | null>(
    null,
  );
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const queryClient = useQueryClient();
  const records = useQuery({
    queryKey: ["admin-records", table, trash, query, page],
    retry: false,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("admin_manage_records", {
        p_action: trash ? "trash" : "list",
        p_table: table,
        p_search: query,
        p_page: page,
      });
      if (error) throw new Error(error.message);
      return data as { rows: ManagedRecord[]; total: number };
    },
  });
  const rows = records.data?.rows ?? [];
  const total = records.data?.total ?? 0;
  const typeLabel = RECORD_TYPES.find(([key]) => key === table)?.[1] ?? "Records";
  const reset = () => {
    setSelected([]);
    setPage(0);
    setError("");
    setFeedback("");
  };
  const requestAction = (action: "delete" | "restore" | "purge", targetRows: ManagedRecord[]) => {
    setConfirmation("");
    setError("");
    setPending({ action, rows: targetRows });
  };
  const act = async () => {
    if (!pending || busy || (pending.action === "purge" && confirmation !== "DELETE")) return;
    setBusy(true);
    setError("");
    try {
      const { data, error } = await (supabase as any).rpc("admin_manage_records", {
        p_action: pending.action,
        p_table: table,
        p_ids: pending.rows.map((row) => row.id),
      });
      if (error) throw new Error(error.message);
      setFeedback(
        String(data.changed) +
          (pending.action === "restore"
            ? " restored."
            : pending.action === "purge"
              ? " permanently deleted."
              : " moved to Trash. Open Trash to restore."),
      );
      setPending(null);
      setSelected([]);
      await queryClient.invalidateQueries();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The action failed. Please refresh and try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="flex h-[min(90dvh,850px)] max-w-5xl flex-col gap-3 overflow-hidden">
        <DialogHeader>
          <DialogTitle>Records & Trash</DialogTitle>
          <DialogDescription>
            Manage submitted information and activity. Deleted records stay in Trash until you permanently remove them.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-end gap-2">
          <label className="min-w-0 flex-1 text-xs">
            Record type
            <select
              aria-label="Record type"
              value={table}
              onChange={(event) => {
                setTable(event.target.value);
                reset();
              }}
              className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-2"
            >
              {RECORD_TYPES.map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-1" aria-label="Record location">
            {[false, true].map((mode) => (
              <button
                type="button"
                key={String(mode)}
                aria-pressed={trash === mode}
                onClick={() => {
                  setTrash(mode);
                  reset();
                }}
                className={
                  "h-10 rounded-lg border px-3 text-sm " +
                  (trash === mode ? "border-primary bg-primary/15 text-primary" : "border-border")
                }
              >
                {mode ? "Trash" : "Active"}
              </button>
            ))}
          </div>
        </div>
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            setQuery(search);
            reset();
          }}
        >
          <input
            aria-label="Search records"
            value={search}
            maxLength={200}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, email, status or record ID"
            className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-sm"
          />
          <button type="submit" className="rounded-lg border border-border px-3 text-sm">
            Search
          </button>
        </form>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span>
            {total} {typeLabel.toLowerCase()}
            {trash ? " in Trash" : ""} · {selected.length} selected
          </span>
          {selected.length > 0 && (
            <div className="flex gap-2">
              {trash && (
                <button
                  type="button"
                  className="rounded-md border border-border px-2 py-2"
                  onClick={() =>
                    requestAction(
                      "restore",
                      rows.filter((row) => selected.includes(row.id)),
                    )
                  }
                >
                  Restore selected
                </button>
              )}
              <button
                type="button"
                className="rounded-md border border-red-400/40 px-2 py-2 text-red-400"
                onClick={() =>
                  requestAction(
                    trash ? "purge" : "delete",
                    rows.filter((row) => selected.includes(row.id)),
                  )
                }
              >
                {trash ? "Delete permanently" : "Delete selected"}
              </button>
            </div>
          )}
        </div>
        {feedback && (
          <p role="status" className="text-sm text-emerald-400">
            {feedback}
          </p>
        )}
        {records.isError ? (
          <div role="alert" className="space-y-2">
            <p className="text-sm text-red-400">{records.error.message}</p>
            <button
              type="button"
              onClick={() => void records.refetch()}
              className="rounded border border-border px-3 py-2"
            >
              Retry
            </button>
          </div>
        ) : records.isLoading ? (
          <p role="status">Loading records…</p>
        ) : (
          <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-border">
            <table className="w-full text-left text-xs">
              <caption className="sr-only">
                {typeLabel} {trash ? "in Trash" : "active records"}
              </caption>
              <thead className="sticky top-0 z-10 bg-card">
                <tr>
                  <th className="p-3">
                    <input
                      type="checkbox"
                      aria-label="Select all records on this page"
                      checked={rows.length > 0 && selected.length === rows.length}
                      onChange={(event) => setSelected(event.target.checked ? rows.map((row) => row.id) : [])}
                    />
                  </th>
                  <th className="py-3">Record</th>
                  <th className="hidden py-3 sm:table-cell">{trash ? "Deleted" : "Created"}</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-border hover:bg-secondary/40">
                    <td className="p-3">
                      <input
                        type="checkbox"
                        aria-label={"Select " + row.label + " " + (row.email ?? row.record_id)}
                        checked={selected.includes(row.id)}
                        onChange={(event) =>
                          setSelected((old) =>
                            event.target.checked ? [...old, row.id] : old.filter((id) => id !== row.id),
                          )
                        }
                      />
                    </td>
                    <td className="max-w-[18rem] py-3 pr-2">
                      <div className="truncate font-medium">{row.label}</div>
                      <div className="truncate text-muted-foreground">{row.email ?? "No email recorded"}</div>
                      <div className="text-muted-foreground">
                        {row.status}
                        {row.amount_cents != null ? " · $" + (row.amount_cents / 100).toFixed(2) : ""}
                      </div>
                      <details className="mt-1 text-muted-foreground">
                        <summary className="cursor-pointer">Record ID</summary>
                        <span className="break-all">{row.record_id}</span>
                      </details>
                    </td>
                    <td className="hidden whitespace-nowrap py-3 pr-2 text-muted-foreground sm:table-cell">
                      {row.date ? new Date(row.date).toLocaleDateString() : "—"}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        {trash && (
                          <button
                            type="button"
                            className="min-h-9 rounded-md border border-border px-2"
                            onClick={() => requestAction("restore", [row])}
                          >
                            Restore
                          </button>
                        )}
                        <button
                          type="button"
                          className="min-h-9 rounded-md border border-red-400/30 px-2 text-red-400"
                          onClick={() => requestAction(trash ? "purge" : "delete", [row])}
                        >
                          {trash ? "Delete permanently" : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && (
              <p className="p-8 text-center text-sm text-muted-foreground">
                {trash ? "Trash is empty for this record type." : "No matching records."}
              </p>
            )}
          </div>
        )}
        <div className="flex items-center justify-between gap-2 text-xs">
          <button
            type="button"
            disabled={page === 0 || records.isFetching}
            onClick={() => {
              setPage(page - 1);
              setSelected([]);
            }}
            className="min-h-9 rounded-md border border-border px-3 disabled:opacity-40"
          >
            Previous
          </button>
          <span>
            Page {page + 1} of {Math.max(1, Math.ceil(total / 50))}
          </span>
          <button
            type="button"
            disabled={(page + 1) * 50 >= total || records.isFetching}
            onClick={() => {
              setPage(page + 1);
              setSelected([]);
            }}
            className="min-h-9 rounded-md border border-border px-3 disabled:opacity-40"
          >
            Next
          </button>
        </div>
        <Dialog
          open={pending !== null}
          onOpenChange={(open) => {
            if (!open && !busy) setPending(null);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {pending?.action === "restore"
                  ? "Restore records?"
                  : pending?.action === "purge"
                    ? "Permanently delete records?"
                    : "Move records to Trash?"}
              </DialogTitle>
              <DialogDescription>
                {pending?.rows.length} {typeLabel.toLowerCase()} selected.{" "}
                {pending?.action === "restore"
                  ? "These records will return to their original pages and reports."
                  : pending?.action === "purge"
                    ? "This removes the recovery copy permanently. This cannot be undone."
                    : "They will leave active lists and reports. You can restore them from Trash. Linked records block deletion instead of being deleted automatically."}
              </DialogDescription>
            </DialogHeader>
            <ul className="max-h-32 overflow-auto text-xs">
              {pending?.rows.map((row) => (
                <li key={row.id} className="py-1">
                  {row.label} · {row.email ?? row.record_id}
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              This does not refund payments, change Stripe, reverse credit balances, or retrieve downloaded files.
              Removing purchases, invites or claims can affect future access that depends on those records. Previously
              sent emails and notifications cannot be recalled.
            </p>
            {pending?.action === "purge" && (
              <label className="text-sm">
                Type DELETE to confirm
                <input
                  aria-label="Type DELETE to confirm"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  className="mt-2 h-10 w-full rounded border border-border bg-background px-3"
                />
              </label>
            )}
            {error && (
              <p role="alert" className="text-sm text-red-400">
                {error}
              </p>
            )}
            <DialogFooter>
              <button
                type="button"
                disabled={busy}
                onClick={() => setPending(null)}
                className="min-h-10 rounded-lg border border-border px-4"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy || (pending?.action === "purge" && confirmation !== "DELETE")}
                onClick={() => void act()}
                className="min-h-10 rounded-lg bg-primary px-4 text-primary-foreground disabled:opacity-40"
              >
                {busy
                  ? "Working…"
                  : pending?.action === "restore"
                    ? "Restore"
                    : pending?.action === "purge"
                      ? "Delete permanently"
                      : "Move to Trash"}
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
