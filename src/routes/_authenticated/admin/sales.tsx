import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { DollarSign, Download, FileText, Loader2, Search, Users, Music, Clock, RefreshCw } from "lucide-react";
import { adminListCustomerActivity, type ActivityRow } from "@/lib/admin-activity.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { generateAgreementPdf, buildAgreementFilename, type AgreementData } from "@/lib/agreement-pdf";
import { EmptyState, PageHeader, StatTile, Surface } from "@/components/admin/ui";
import { cn } from "@/lib/utils";
import { CustomerRecordDrawer } from "./customers";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/sales")({
  head: () => ({ meta: [{ title: "Admin · Sales & Downloads — MYBEATCATALOG" }] }),
  validateSearch: (s) => z.object({ day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).parse(s),
  component: AdminSalesPage,
});

const TABS = [
  { key: "all", label: "All activity" },
  { key: "purchase", label: "Purchases" },
  { key: "member_download", label: "Member downloads" },
  { key: "free_download", label: "Free downloads" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const money = (c: number | null) => (c == null ? "—" : `$${(c / 100).toFixed(2)}`);

function kindLabel(r: ActivityRow) {
  if (r.kind === "purchase") return r.paid ? "Paid sale" : "Checkout started";
  return r.kind === "member_download" ? "Member download" : "Free download";
}

function AdminSalesPage() {
  const { day } = Route.useSearch();
  const qc = useQueryClient();
  const [customer, setCustomer] = useState<string | null>(null);
  const [range, setRange] = useState("30");
  const [payment, setPayment] = useState("all");
  const [sort, setSort] = useState("newest");
  const [busyId, setBusyId] = useState<string | null>(null);
  const fetchActivity = useServerFn(adminListCustomerActivity);
  const [tab, setTab] = useState<TabKey>("all");
  const [q, setQ] = useState("");

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["admin-customer-activity"],
    queryFn: () => fetchActivity(),
  });

  const rows = data?.rows ?? [];

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows
      .filter((r) => {
        if (tab !== "all" && r.kind !== tab) return false;
        if (day) {
          const date = new Date(r.created_at);
          const key = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
          if (key !== day) return false;
        }
        if (!day && range !== "all" && new Date(r.created_at).getTime() < Date.now() - Number(range) * 86400000) return false;
        if (payment === "paid" && !(r.kind === "purchase" && r.paid)) return false;
        if (payment === "pending" && !(r.kind === "purchase" && !r.paid)) return false;
        if (!s) return true;
        return (
          r.email?.toLowerCase().includes(s) ||
          r.name?.toLowerCase().includes(s) ||
          r.beat_title.toLowerCase().includes(s) ||
          r.agreement_code?.toLowerCase().includes(s)
        );
      })
      .sort((a, b) =>
        sort === "amount"
          ? (b.amount_cents ?? 0) - (a.amount_cents ?? 0)
          : sort === "oldest"
            ? a.created_at.localeCompare(b.created_at)
            : b.created_at.localeCompare(a.created_at),
      );
  }, [rows, tab, q, range, payment, sort, day]);
  const summary = {
    paidRevenueCents: filtered
      .filter((r) => r.kind === "purchase" && r.paid)
      .reduce((sum, r) => sum + (r.amount_cents ?? 0), 0),
    paidCount: filtered.filter((r) => r.kind === "purchase" && r.paid).length,
    pendingCount: filtered.filter((r) => r.kind === "purchase" && !r.paid).length,
    memberDownloads: filtered.filter((r) => r.kind === "member_download").length,
    freeDownloads: filtered.filter((r) => r.kind === "free_download").length,
    uniqueCustomers: new Set(filtered.map((r) => r.email?.toLowerCase()).filter(Boolean)).size,
  };
  const deleteRecord = async (row: ActivityRow) => {
    if (
      !window.confirm(
        `Move this ${kindLabel(row).toLowerCase()} for ${row.email || "unknown customer"} to Trash?\n\nIt will leave active lists and reports. Restore it in Records & Trash. No refund or credit reversal is performed. Removing a purchase can affect future access that uses this record.`,
      )
    )
      return;
    setBusyId(row.id);
    try {
      const table =
        row.kind === "purchase" ? "lease_orders" : row.kind === "free_download" ? "beat_lead_captures" : "downloads";
      const { error } = await (supabase as any).rpc("admin_manage_records", {
        p_action: "delete",
        p_table: table,
        p_ids: [row.id.split(":")[1]],
      });
      if (error) throw new Error(error.message);
      await qc.invalidateQueries();
      toast.success("Moved to Trash. Restore from Records & Trash.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete record");
    } finally {
      setBusyId(null);
    }
  };

  const downloadPdf = async (agreementRowId: string) => {
    if (agreementRowId.startsWith("lic:")) {
      const { data: r } = await (supabase as any)
        .from("purchase_licenses").select("*").eq("id", agreementRowId.slice(4)).maybeSingle();
      if (!r) return;
      const doc: AgreementData = {
        agreement_id: r.agreement_code,
        user_name: r.buyer_name || r.email,
        user_email: r.email,
        beat_title: r.beat_title,
        beat_id: r.beat_id ?? "",
        producer_name: "KRAZYJAYDOTCOM",
        license_type: r.license_label,
        credits_used: 0,
        file_type: r.license_tier === "nonexclusive" ? "MP3" : r.license_tier === "trackout" ? "WAV + MP3 + STEMs" : "WAV + MP3",
        accepted_at: r.created_at,
        agreement_text: `${r.rights_text}\n\nProducer credits (required): Writer — Jason A. Spencer (IPI 516703075) 50%; Publishing — March 26th Publishing (IPI 1213085595) 50%; PRO — ASCAP. Failure to register these splits voids the rights granted.\n\nRestrictions: Licensee may not resell, redistribute, sublicense, or claim sole ownership of the underlying beat. MYBEATCATALOG retains ownership of the composition and production.\n\nAmount paid: $${(r.amount_cents / 100).toFixed(2)}${r.payment_environment === "sandbox" ? " (test payment)" : ""}`,
      } as AgreementData;
      generateAgreementPdf(doc).save(`MBC_${r.agreement_code}.pdf`);
      return;
    }
    const { data: a } = await supabase.from("agreements").select("*").eq("id", agreementRowId).maybeSingle();
    if (!a) return;
    const doc = a as unknown as AgreementData;
    generateAgreementPdf(doc).save(buildAgreementFilename(doc));
  };

  const exportCsv = () => {
    const head = ["Date", "Type", "Name", "Email", "Beat", "Amount", "Status", "License", "Agreement"];
    const lines = filtered.map((r) => [
      new Date(r.created_at).toISOString(),
      r.kind,
      r.name ?? "",
      r.email ?? "",
      r.beat_title,
      r.amount_cents == null ? "" : (r.amount_cents / 100).toFixed(2),
      r.kind === "purchase" ? (r.paid ? "paid" : "pending") : "",
      r.license_type ?? "",
      r.agreement_code ?? "",
    ]);
    const csv = [head, ...lines]
      .map((cols) => cols.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `mbc-sales-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {day && <p className="text-sm text-primary">Sales on {day} · <a href="/admin/sales" className="underline">Clear date</a></p>}
      <PageHeader
        breadcrumb="Business"
        title="Sales & downloads"
        description="Active records only; deleted records are excluded. These totals are not a Stripe reconciliation."
        actions={
          <>
            <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={cn("mr-1 h-4 w-4", isFetching && "animate-spin")} /> Refresh
            </Button>
            <Button size="sm" variant="outline" onClick={exportCsv} disabled={filtered.length === 0}>
              Export CSV
            </Button>
          </>
        }
      />

      <div className="flex shrink-0 flex-wrap gap-2">
        <select
          aria-label="Reporting date range"
          value={range}
          onChange={(e) => setRange(e.target.value)}
          className="h-10 rounded-lg border border-border bg-card px-3 text-xs"
        >
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="all">All available records</option>
        </select>
        <select
          aria-label="Payment status"
          value={payment}
          onChange={(e) => setPayment(e.target.value)}
          className="h-10 rounded-lg border border-border bg-card px-3 text-xs"
        >
          <option value="all">All statuses</option>
          <option value="paid">Paid purchases</option>
          <option value="pending">Unpaid checkouts</option>
        </select>
        <select
          aria-label="Sort activity"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="h-10 rounded-lg border border-border bg-card px-3 text-xs"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="amount">Highest amount</option>
        </select>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setRange("30");
            setPayment("all");
            setQ("");
            setTab("all");
            setSort("newest");
          }}
        >
          Reset filters
        </Button>
      </div>
      <div className="grid shrink-0 grid-cols-3 gap-2 lg:grid-cols-5">
        <StatTile
          icon={DollarSign}
          label="Paid revenue"
          value={money(summary?.paidRevenueCents ?? 0)}
          hint="Matching current filters"
        />
        <StatTile icon={Music} label="Paid sales" value={summary?.paidCount ?? 0} />
        <StatTile icon={Clock} label="Unpaid checkouts" value={summary?.pendingCount ?? 0} />
        <StatTile
          icon={Download}
          label="Downloads"
          value={(summary?.memberDownloads ?? 0) + (summary?.freeDownloads ?? 0)}
        />
        <StatTile icon={Users} label="Unique customers" value={summary?.uniqueCustomers ?? 0} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "min-h-11 rounded-full px-4 text-sm font-semibold transition",
              tab === t.key
                ? "bg-primary text-primary-foreground"
                : "border border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
        <div className="relative w-full sm:ml-auto sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, email, beat, agreement…"
            className="h-11 pl-9 text-base"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState title="Nothing here yet" description="Sales and downloads appear as soon as they happen." />
        ) : (
          <>
            {/* Mobile: stacked cards */}
            <div className="space-y-2 md:hidden">
              {filtered.map((r) => (
                <Surface key={r.id} className="p-3">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{r.beat_title}</div>
                      <button
                        disabled={!r.email}
                        onClick={() => r.email && setCustomer(r.email)}
                        className="truncate text-left text-xs text-primary disabled:text-muted-foreground"
                      >
                        {r.name || r.email || "No customer identity recorded"}
                      </button>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-sm font-semibold tabular-nums">{money(r.amount_cents)}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {new Date(r.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="outline" disabled={busyId !== null} onClick={() => void deleteRecord(r)}>
                      Delete
                    </Button>
                    <Badge variant={r.kind === "purchase" && r.paid ? "default" : "secondary"}>{kindLabel(r)}</Badge>
                    {r.agreement_row_id ? (
                      <Button size="sm" variant="outline" className="min-h-11" onClick={() => onPdf(r, downloadPdf)}>
                        <FileText className="mr-1 h-4 w-4" /> {r.agreement_code ?? "License PDF"}
                      </Button>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">{r.kind === "free_download" ? "Tagged preview · no paid license needed" : "License needs review"}</span>
                    )}
                  </div>
                </Surface>
              ))}
            </div>

            {/* Desktop: table */}
            <Surface className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[820px] text-sm">
                <thead className="border-b border-border/60 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Date</th>
                    <th className="px-4 py-3 text-left font-medium">Customer</th>
                    <th className="px-4 py-3 text-left font-medium">Beat</th>
                    <th className="px-4 py-3 text-left font-medium">Type</th>
                    <th className="px-4 py-3 text-left font-medium">Amount</th>
                    <th className="px-4 py-3 text-right font-medium">License doc</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id} className="border-t border-border/50 hover:bg-secondary/50">
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                        {new Date(r.created_at).toLocaleDateString()}
                        <div className="text-[11px] text-muted-foreground/80">
                          {new Date(r.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          disabled={!r.email}
                          onClick={() => r.email && setCustomer(r.email)}
                          className="text-left font-medium text-primary hover:underline disabled:text-muted-foreground"
                        >
                          {r.name || r.email || "No customer identity recorded"}
                        </button>
                        {r.name && r.email && <div className="text-xs text-muted-foreground">{r.email}</div>}
                      </td>
                      <td className="px-4 py-3">
                        {r.beat_slug ? (
                          <a
                            className="font-medium text-primary hover:underline"
                            href={"/beats/" + encodeURIComponent(r.beat_slug)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {r.beat_title}
                          </a>
                        ) : (
                          <div className="font-medium">{r.beat_title}</div>
                        )}
                        {r.detail && <div className="text-xs text-muted-foreground">{r.detail}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={
                            r.kind === "purchase" && r.paid
                              ? "default"
                              : r.kind === "free_download"
                                ? "outline"
                                : "secondary"
                          }
                        >
                          {kindLabel(r)}
                        </Badge>
                        {r.license_type && (
                          <div className="mt-1 text-[11px] text-muted-foreground">{r.license_type}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 tabular-nums">{money(r.amount_cents)}</td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-400"
                          disabled={busyId !== null}
                          onClick={() => void deleteRecord(r)}
                        >
                          Delete
                        </Button>
                        {r.agreement_row_id ? (
                          <Button size="sm" variant="ghost" onClick={() => downloadPdf(r.agreement_row_id!)}>
                            <FileText className="mr-1 h-4 w-4" /> {r.agreement_code ?? "PDF"}
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">{r.kind === "free_download" ? "Tagged preview · no paid license needed" : "License needs review"}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Surface>
          </>
        )}
      </div>
      {customer && <CustomerRecordDrawer email={customer} onClose={() => setCustomer(null)} />}
    </div>
  );
}

function onPdf(r: ActivityRow, dl: (id: string) => void) {
  if (r.agreement_row_id) dl(r.agreement_row_id);
}
