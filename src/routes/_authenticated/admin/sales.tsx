import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  DollarSign, Download, FileText, Loader2, Search, Users, Music, Clock, RefreshCw,
} from "lucide-react";
import { adminListCustomerActivity, type ActivityRow } from "@/lib/admin-activity.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { generateAgreementPdf, buildAgreementFilename, type AgreementData } from "@/lib/agreement-pdf";
import { EmptyState, PageHeader, StatTile, Surface } from "@/components/admin/ui";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/sales")({
  head: () => ({ meta: [{ title: "Admin · Sales & Downloads — MYBEATCATALOG" }] }),
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
  const fetchActivity = useServerFn(adminListCustomerActivity);
  const [tab, setTab] = useState<TabKey>("all");
  const [q, setQ] = useState("");

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["admin-customer-activity"],
    queryFn: () => fetchActivity(),
  });

  const rows = data?.rows ?? [];
  const summary = data?.summary;

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (tab !== "all" && r.kind !== tab) return false;
      if (!s) return true;
      return (
        r.email?.toLowerCase().includes(s) ||
        r.name?.toLowerCase().includes(s) ||
        r.beat_title.toLowerCase().includes(s) ||
        r.agreement_code?.toLowerCase().includes(s)
      );
    });
  }, [rows, tab, q]);

  const downloadPdf = async (agreementRowId: string) => {
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
    <div className="space-y-5">
      <PageHeader
        breadcrumb="Business"
        title="Sales &amp; downloads"
        description="Everyone who bought or downloaded, what they got, and their license documents."
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

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile icon={DollarSign} label="Paid revenue" value={money(summary?.paidRevenueCents ?? 0)} hint="Confirmed payments only" />
        <StatTile icon={Music} label="Paid sales" value={summary?.paidCount ?? 0} />
        <StatTile icon={Clock} label="Unpaid checkouts" value={summary?.pendingCount ?? 0} />
        <StatTile icon={Download} label="Downloads" value={(summary?.memberDownloads ?? 0) + (summary?.freeDownloads ?? 0)} />
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

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
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
                    <div className="truncate text-xs text-muted-foreground">{r.name ?? r.email ?? "—"}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-sm font-semibold tabular-nums">{money(r.amount_cents)}</div>
                    <div className="text-[11px] text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</div>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge variant={r.kind === "purchase" && r.paid ? "default" : "secondary"}>{kindLabel(r)}</Badge>
                  {r.agreement_row_id ? (
                    <Button size="sm" variant="outline" className="min-h-11" onClick={() => onPdf(r, downloadPdf)}>
                      <FileText className="mr-1 h-4 w-4" /> {r.agreement_code ?? "License PDF"}
                    </Button>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">No license document on file</span>
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
                      <div className="font-medium">{r.name ?? r.email ?? "—"}</div>
                      {r.name && r.email && <div className="text-xs text-muted-foreground">{r.email}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{r.beat_title}</div>
                      {r.detail && <div className="text-xs text-muted-foreground">{r.detail}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={r.kind === "purchase" && r.paid ? "default" : r.kind === "free_download" ? "outline" : "secondary"}>
                        {kindLabel(r)}
                      </Badge>
                      {r.license_type && <div className="mt-1 text-[11px] text-muted-foreground">{r.license_type}</div>}
                    </td>
                    <td className="px-4 py-3 tabular-nums">{money(r.amount_cents)}</td>
                    <td className="px-4 py-3 text-right">
                      {r.agreement_row_id ? (
                        <Button size="sm" variant="ghost" onClick={() => downloadPdf(r.agreement_row_id!)}>
                          <FileText className="mr-1 h-4 w-4" /> {r.agreement_code ?? "PDF"}
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">No license document on file</span>
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
  );
}

function onPdf(r: ActivityRow, dl: (id: string) => void) {
  if (r.agreement_row_id) dl(r.agreement_row_id);
}
