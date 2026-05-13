import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, FileText, Loader2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { KrazyLogo } from "@/components/krazy-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { generateAgreementPdf, buildAgreementFilename, type AgreementData } from "@/lib/agreement-pdf";

export const Route = createFileRoute("/_authenticated/agreements")({
  head: () => ({ meta: [{ title: "My Agreements — MYBEATCATALOG" }] }),
  component: AgreementsPage,
});

function AgreementsPage() {
  const { user } = useAuth();
  const [q, setQ] = useState("");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["agreements", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agreements")
        .select("*")
        .order("accepted_at", { ascending: false });
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
      r.license_type.toLowerCase().includes(s)
    );
  });

  const download = (a: AgreementData) => {
    const pdf = generateAgreementPdf(a);
    pdf.save(buildAgreementFilename(a));
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Link to="/beats" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <Link to="/"><KrazyLogo className="text-xl" /></Link>
          </div>
          <Button variant="heroOutline" size="sm" asChild>
            <Link to="/downloads">View Downloads</Link>
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 py-10 max-w-5xl">
        <h1 className="text-3xl font-black tracking-tight">My License Agreements</h1>
        <p className="mt-2 text-muted-foreground">Every beat download generates a unique license agreement. Re-download anytime.</p>

        <div className="mt-6 relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by agreement ID, beat, or license…" className="pl-9" />
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
                  <th className="text-left px-5 py-3 font-medium hidden sm:table-cell">Beat</th>
                  <th className="text-left px-5 py-3 font-medium hidden md:table-cell">License</th>
                  <th className="text-left px-5 py-3 font-medium hidden sm:table-cell">Accepted</th>
                  <th className="text-right px-5 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r: any) => (
                  <tr key={r.id} className="border-t border-border hover:bg-muted/20">
                    <td className="px-5 py-4 font-mono text-xs">{r.agreement_id}</td>
                    <td className="px-5 py-4 hidden sm:table-cell">
                      <div className="font-medium">{r.beat_title}</div>
                      <div className="text-xs text-muted-foreground">{r.producer_name}</div>
                    </td>
                    <td className="px-5 py-4 hidden md:table-cell"><Badge variant="secondary">{r.license_type}</Badge></td>
                    <td className="px-5 py-4 text-muted-foreground hidden sm:table-cell">{new Date(r.accepted_at).toLocaleDateString()}</td>
                    <td className="px-5 py-4 text-right">
                      <Button size="sm" variant="ghost" onClick={() => download(r as AgreementData)}>
                        <FileText className="h-4 w-4 mr-1" /> Download PDF
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
