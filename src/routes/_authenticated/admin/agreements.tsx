import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, FileText, Loader2, Search, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { KrazyLogo } from "@/components/krazy-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { generateAgreementPdf, type AgreementData } from "@/lib/agreement-pdf";

export const Route = createFileRoute("/_authenticated/admin/agreements")({
  head: () => ({ meta: [{ title: "Admin · Agreements — KRAZYJAYDOTCOM" }] }),
  component: AdminAgreementsPage,
});

function AdminAgreementsPage() {
  const { user } = useAuth();
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

  const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '');
  const download = (a: AgreementData & { licensed_to?: string }) => {
    const pdf = generateAgreementPdf(a);
    const beat = a.beat_title ? slugify(a.beat_title) : a.agreement_id;
    const who = a.licensed_to ? slugify(a.licensed_to) : (a.user_name ? slugify(a.user_name) : a.agreement_id);
    pdf.save(`License_${beat}_${who}.pdf`);
  };

  if (isAdmin === null) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center">
        <ShieldCheck className="h-12 w-12 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Admin access only</h1>
        <p className="text-muted-foreground">You don't have permission to view this console.</p>
        <Button variant="hero" asChild><Link to="/beats">Back to Beats</Link></Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Link to="/beats" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <Link to="/"><KrazyLogo className="text-xl" /></Link>
            <Badge variant="secondary" className="ml-2">ADMIN</Badge>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-10 max-w-6xl">
        <h1 className="text-3xl font-black tracking-tight">All License Agreements</h1>
        <p className="mt-2 text-muted-foreground">{rows.length} total · showing latest 500</p>

        <div className="mt-6 relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search agreement ID, beat, user name or email…" className="pl-9" />
        </div>

        <div className="mt-6 rounded-2xl border border-border bg-card overflow-hidden">
          {isLoading ? (
            <div className="p-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">No agreements found.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-5 py-3 font-medium">Agreement ID</th>
                  <th className="text-left px-5 py-3 font-medium">User</th>
                  <th className="text-left px-5 py-3 font-medium">Beat</th>
                  <th className="text-left px-5 py-3 font-medium">License</th>
                  <th className="text-left px-5 py-3 font-medium">Accepted</th>
                  <th className="text-right px-5 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r: any) => (
                  <tr key={r.id} className="border-t border-border hover:bg-muted/20">
                    <td className="px-5 py-4 font-mono text-xs">{r.agreement_id}</td>
                    <td className="px-5 py-4">
                      <div className="font-medium">{r.user_name}</div>
                      <div className="text-xs text-muted-foreground">{r.user_email}</div>
                    </td>
                    <td className="px-5 py-4">{r.beat_title}</td>
                    <td className="px-5 py-4"><Badge variant="secondary">{r.license_type}</Badge></td>
                    <td className="px-5 py-4 text-muted-foreground">{new Date(r.accepted_at).toLocaleDateString()}</td>
                    <td className="px-5 py-4 text-right">
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
    </div>
  );
}
