import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download as DownloadIcon, FileText, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { KrazyLogo } from "@/components/krazy-logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { generateAgreementPdf, buildAgreementFilename, type AgreementData } from "@/lib/agreement-pdf";

export const Route = createFileRoute("/_authenticated/downloads")({
  head: () => ({ meta: [{ title: "My Downloads — MYBEATCATALOG" }] }),
  component: DownloadsPage,
});

type Row = {
  id: string;
  created_at: string;
  file_type: string;
  credits_used: number;
  beats: { title: string; producer_name: string; audio_url: string | null } | null;
  agreements: { id: string; agreement_id: string }[];
};

function DownloadsPage() {
  const { user } = useAuth();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["downloads", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("downloads")
        .select("id, created_at, file_type, credits_used, beats(title, producer_name, audio_url), agreements(id, agreement_id)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const reDownload = async (audioUrl: string | null, title: string) => {
    if (!audioUrl) return;
    const a = document.createElement("a");
    a.href = audioUrl;
    const safeTitle = (title || "beat").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "");
    a.download = `KRAZYJAYDOTCOM_${safeTitle}.mp3`;
    a.target = "_blank";
    a.click();
  };

  const downloadAgreement = async (agreementRowId: string) => {
    const { data, error } = await supabase
      .from("agreements")
      .select("*")
      .eq("id", agreementRowId)
      .maybeSingle();
    if (error || !data) return;
    const a = data as unknown as AgreementData;
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
            <Link to="/agreements">View Agreements</Link>
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 py-10 max-w-5xl">
        <h1 className="text-3xl font-black tracking-tight">My Downloads</h1>
        <p className="mt-2 text-muted-foreground">Re-download any beat you've previously redeemed. No extra credits charged.</p>

        <div className="mt-8 rounded-2xl border border-border bg-card overflow-hidden">
          {isLoading ? (
            <div className="p-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : rows.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              No downloads yet. <Link to="/beats" className="text-primary hover:underline">Browse the catalog</Link>.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-5 py-3 font-medium">Beat</th>
                  <th className="text-left px-5 py-3 font-medium hidden sm:table-cell">Date</th>
                  <th className="text-left px-5 py-3 font-medium hidden sm:table-cell">Format</th>
                  <th className="text-left px-5 py-3 font-medium hidden md:table-cell">Credits</th>
                  <th className="text-right px-5 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-border hover:bg-muted/20">
                    <td className="px-5 py-4">
                      <div className="font-medium">{r.beats?.title ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{r.beats?.producer_name}</div>
                    </td>
                    <td className="px-5 py-4 text-muted-foreground hidden sm:table-cell">{new Date(r.created_at).toLocaleDateString()}</td>
                    <td className="px-5 py-4 hidden sm:table-cell"><Badge variant="secondary">{r.file_type}</Badge></td>
                    <td className="px-5 py-4 text-muted-foreground hidden md:table-cell">{r.credits_used}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <Button size="sm" variant="ghost" onClick={() => reDownload(r.beats?.audio_url ?? null, r.beats?.title ?? "beat")}>
                          <DownloadIcon className="h-4 w-4 mr-1" /> Audio
                        </Button>
                        {r.agreements?.[0] && (
                          <Button size="sm" variant="ghost" onClick={() => downloadAgreement(r.agreements[0].id)}>
                            <FileText className="h-4 w-4 mr-1" /> PDF
                          </Button>
                        )}
                      </div>
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
