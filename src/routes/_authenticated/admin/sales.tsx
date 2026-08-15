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
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Sales &amp; Downloads</h1>
          <p className="mt-1 text-sm text-slate-400">
            Everyone who bought or downloaded, what they got, and their license documents.
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn("mr-1 h-4 w-4", isFetching && "animate-spin")} /> Refresh
          </Button>
          <Button size="sm" variant="outline" onClick={exportCsv} disabled={filtered.length === 0}>
            Export CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat icon={DollarSign} label="Paid revenue" value={money(summary?.paidRevenueCents ?? 0)} />
        <Stat icon={Music} label="Paid sales" value={summary?.paidCount ?? 0} />
        <Stat icon={Clock} label="Pending checkouts" value={summary?.pendingCount ?? 0} />
        <Stat icon={Download} label="Downloads" value={(summary?.memberDownloads ?? 0) + (summary?.freeDownloads ?? 0)} />
        <Stat icon={Users} label="Unique customers" value={summary?.uniqueCustomers ?? 0} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-semibold transition",
              tab === t.key ? "bg-primary text-white" : "border border-slate-800 text-slate-300 hover:text-white",
            )}
          >
            {t.label}
          </button>
        ))}
        <div className="relative ml-auto w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, email, beat, agreement…"
            className="pl-9"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-800/90 bg-slate-950/50">
        {isLoading ? (
          <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-400">Nothing here yet.</div>
        ) : (
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-slate-900/60 text-[11px] uppercase tracking-wider text-slate-400">
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
                <Row key={r.id} r={r} onPdf={downloadPdf} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Row({ r, onPdf }: { r: ActivityRow; onPdf: (id: string) => void }) {
  return (
    <tr className="border-t border-slate-800/80 hover:bg-slate-900/40">
      <td className="whitespace-nowrap px-4 py-3 text-slate-400">
        {new Date(r.created_at).toLocaleDateString()}
        <div className="text-[11px] text-slate-500">{new Date(r.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</div>
      </td>
      <td className="px-4 py-3">
        <div className="font-medium text-slate-100">{r.name ?? r.email ?? "—"}</div>
        {r.name && r.email && <div className="text-xs text-slate-500">{r.email}</div>}
      </td>
      <td className="px-4 py-3">
        <div className="font-medium text-slate-100">{r.beat_title}</div>
        {r.detail && <div className="text-xs text-slate-500">{r.detail}</div>}
      </td>
      <td className="px-4 py-3">
        {r.kind === "purchase" ? (
          <Badge variant={r.paid ? "default" : "secondary"}>{r.paid ? "Paid sale" : "Checkout started"}</Badge>
        ) : r.kind === "member_download" ? (
          <Badge variant="secondary">Member download</Badge>
        ) : (
          <Badge variant="outline">Free download</Badge>
        )}
        {r.license_type && <div className="mt-1 text-[11px] text-slate-500">{r.license_type}</div>}
      </td>
      <td className="px-4 py-3 text-slate-300">{money(r.amount_cents)}</td>
      <td className="px-4 py-3 text-right">
        {r.agreement_row_id ? (
          <Button size="sm" variant="ghost" onClick={() => onPdf(r.agreement_row_id!)}>
            <FileText className="mr-1 h-4 w-4" /> {r.agreement_code ?? "PDF"}
          </Button>
        ) : (
          <span className="text-xs text-slate-600">—</span>
        )}
      </td>
    </tr>
  );
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-slate-800/90 bg-slate-950/50 p-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wider text-slate-500">{label}</span>
        <Icon className="h-4 w-4 text-slate-500" />
      </div>
      <div className="mt-2 text-2xl font-bold text-slate-100">{value}</div>
    </div>
  );
}
