import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, FileText, Loader2, Search, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { CustomerRecordDrawer } from "./customers";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { generateAgreementPdf, buildAgreementFilename, type AgreementData } from "@/lib/agreement-pdf";

export const Route = createFileRoute("/_authenticated/admin/agreements")({
  head: () => ({ meta: [{ title: "Admin · Agreements — MYBEATCATALOG" }] }),
  component: AdminAgreementsPage,
});

function AdminAgreementsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [customer, setCustomer] = useState<string | null>(null);
  const remove = async (id: string) => {
    if (
      !window.confirm(
        "Move this agreement record to Trash? This removes it from active records; it does not cancel the accepted license. Restore it in Records & Trash.",
      )
    )
      return;
    const { error } = await (supabase as any).rpc("admin_manage_records", {
      p_action: "delete",
      p_table: "agreements",
      p_ids: [id],
    });
    if (error) toast.error(error.message);
    else {
      await qc.invalidateQueries();
      toast.success("Agreement moved to Trash");
    }
  };
  const [q, setQ] = useState("");
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle()
      .then(({ data }) => setIsAdmin(!!data));
  }, [user]);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-agreements"],
    enabled: isAdmin === true,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agreements")
        .select("*")
        .order("accepted_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = rows.filter((r: any) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return (
      r.agreement_id.toLowerCase().includes(s) ||
      r.beat_title.toLowerCase().includes(s) ||
      r.user_name?.toLowerCase().includes(s) ||
      r.user_email?.toLowerCase().includes(s)
    );
  });

  const download = (a: AgreementData) => {
    const pdf = generateAgreementPdf(a);
    pdf.save(buildAgreementFilename(a));
  };

  if (isAdmin === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center">
        <ShieldCheck className="h-12 w-12 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Admin access only</h1>
        <p className="text-muted-foreground">You don't have permission to view this console.</p>
        <Button variant="hero" asChild>
          <Link to="/beats">Back to Beats</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <main className="flex min-h-0 flex-1 flex-col gap-3">
        <h1 className="text-2xl font-bold tracking-tight">All License Agreements</h1>
        <p className="text-xs text-muted-foreground">{rows.length} total · showing latest 500</p>

        <div className="relative shrink-0 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search agreement ID, beat, user name or email…"
            className="pl-9"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-border bg-card text-foreground">
          {isLoading ? (
            <div className="p-12 flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">No agreements found.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-5 py-3 font-medium">Agreement ID</th>
                  <th className="text-left px-5 py-3 font-medium hidden md:table-cell">User</th>
                  <th className="text-left px-5 py-3 font-medium hidden sm:table-cell">Beat</th>
                  <th className="text-left px-5 py-3 font-medium hidden lg:table-cell">License</th>
                  <th className="text-left px-5 py-3 font-medium hidden md:table-cell">Accepted</th>
                  <th className="text-right px-5 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r: any) => (
                  <tr key={r.id} className="border-t border-border hover:bg-secondary/50">
                    <td className="px-5 py-4 font-mono text-xs">{r.agreement_id}</td>
                    <td className="px-5 py-4 hidden md:table-cell">
                      <button
                        className="text-left font-medium text-primary hover:underline"
                        onClick={() => r.user_email && setCustomer(r.user_email)}
                      >
                        {r.user_name || r.user_email || "Unknown customer"}
                      </button>
                      <div className="text-xs text-muted-foreground">{r.user_email}</div>
                    </td>
                    <td className="px-5 py-4 hidden sm:table-cell">{r.beat_title}</td>
                    <td className="px-5 py-4 hidden lg:table-cell">
                      <Badge variant="secondary">{r.license_type}</Badge>
                    </td>
                    <td className="px-5 py-4 text-muted-foreground hidden md:table-cell">
                      {new Date(r.accepted_at).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Button size="sm" variant="ghost" className="text-red-400" onClick={() => void remove(r.id)}>
                        Delete
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => download(r as AgreementData)}>
                        <FileText className="h-4 w-4 mr-1" /> PDF
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
      {customer && <CustomerRecordDrawer email={customer} onClose={() => setCustomer(null)} />}
    </div>
  );
}
