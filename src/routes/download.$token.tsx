import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { getPurchaseDownload } from "@/lib/download-link.functions";
import { PurchaseDownloadCard } from "@/components/store/purchase-download-card";

export const Route = createFileRoute("/download/$token")({
  head: () => ({
    meta: [
      { title: "Your purchase — MYBEATCATALOG" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PurchaseDownloadPage,
});

// Legacy shape kept alive for links already emailed to buyers.
function PurchaseDownloadPage() {
  const { token } = Route.useParams();
  const fetchDownload = useServerFn(getPurchaseDownload);
  const { data, isLoading, error } = useQuery({
    queryKey: ["purchase-download", "token", token],
    queryFn: () => fetchDownload({ data: { token } }),
    retry: false,
  });

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6">
        {isLoading ? (
          <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : error || !data ? (
          <div className="text-center">
            <h1 className="text-xl font-bold tracking-tight text-foreground">Link not found</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              This download link is invalid or has expired. If you purchased a beat, you can get your license at{" "}
              <Link to="/licenses" className="text-primary underline">mybeatcatalog.com/licenses</Link>.
            </p>
          </div>
        ) : (
          <PurchaseDownloadCard data={data} />
        )}
      </div>
    </div>
  );
}
