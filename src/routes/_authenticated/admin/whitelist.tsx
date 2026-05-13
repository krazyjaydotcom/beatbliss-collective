import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, ExternalLink, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/whitelist")({
  head: () => ({ meta: [{ title: "Admin · Whitelist — MYBEATCATALOG" }] }),
  component: AdminWhitelistPage,
});

function AdminWhitelistPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-whitelist"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whitelist_submissions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = rows.filter((r: any) => filter === "all" || r.status === filter);

  async function decide(id: string, status: "approved" | "rejected", admin_notes: string | null) {
    const { error } = await supabase.from("whitelist_submissions").update({ status, admin_notes }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(status === "approved" ? "Approved" : "Rejected");
    qc.invalidateQueries({ queryKey: ["admin-whitelist"] });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight">Whitelist Submissions</h1>
        <p className="text-muted-foreground mt-1">Review tracks members have released using your beats.</p>
      </div>

      <div className="flex gap-2">
        {(["pending", "approved", "rejected", "all"] as const).map((f) => (
          <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No submissions in this view.</p>
      ) : (
        <div className="space-y-4">
          {filtered.map((r: any) => (
            <SubmissionCard key={r.id} row={r} onDecide={decide} />
          ))}
        </div>
      )}
    </div>
  );
}

function SubmissionCard({ row, onDecide }: { row: any; onDecide: (id: string, status: "approved" | "rejected", notes: string | null) => void }) {
  const [notes, setNotes] = useState(row.admin_notes ?? "");
  const isPending = row.status === "pending";

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="font-semibold">{row.track_title} <span className="text-muted-foreground font-normal">— {row.artist_name}</span></div>
          <a href={row.streaming_url} target="_blank" rel="noreferrer" className="text-xs text-electric hover:underline inline-flex items-center gap-1 mt-1">
            <ExternalLink className="h-3 w-3" /> {row.streaming_url}
          </a>
          {row.notes && <p className="text-sm text-muted-foreground mt-2">"{row.notes}"</p>}
          <p className="text-xs text-muted-foreground mt-2">
            {row.release_date ? `Released ${row.release_date} · ` : ""}Submitted {new Date(row.created_at).toLocaleDateString()}
          </p>
        </div>
        <Badge variant={row.status === "pending" ? "secondary" : row.status === "approved" ? "default" : "destructive"}>{row.status}</Badge>
      </div>
      <div className="mt-4 space-y-2">
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Admin notes (visible to user)" rows={2} maxLength={1000} />
        <div className="flex gap-2">
          <Button size="sm" onClick={() => onDecide(row.id, "approved", notes || null)} disabled={!isPending}>
            <Check className="h-4 w-4 mr-1" /> Approve
          </Button>
          <Button size="sm" variant="destructive" onClick={() => onDecide(row.id, "rejected", notes || null)} disabled={!isPending}>
            <X className="h-4 w-4 mr-1" /> Reject
          </Button>
        </div>
      </div>
    </div>
  );
}
