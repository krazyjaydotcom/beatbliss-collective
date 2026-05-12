import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Search, UserCheck, UserX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/access")({
  head: () => ({ meta: [{ title: "Admin · Manual Access — KRAZYJAYDOTCOM" }] }),
  component: AdminAccessPage,
});

function AdminAccessPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<any | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { data: results, isFetching } = useQuery({
    queryKey: ["access-search", q],
    enabled: q.length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, display_name, full_name, subscription_tier, subscription_status")
        .or(`email.ilike.%${q}%,display_name.ilike.%${q}%,full_name.ilike.%${q}%`)
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  async function grantAccess() {
    if (!selected) return;
    setSubmitting(true);
    const { error } = await supabase
      .from("profiles")
      .update({ subscription_tier: "artist", subscription_status: "active" })
      .eq("id", selected.id);
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success(`✅ Access granted to ${selected.email}`);
    setSelected({ ...selected, subscription_tier: "artist", subscription_status: "active" });
    qc.invalidateQueries({ queryKey: ["admin-members"] });
  }

  async function revokeAccess() {
    if (!selected) return;
    setSubmitting(true);
    const { error } = await supabase
      .from("profiles")
      .update({ subscription_tier: "free", subscription_status: "inactive" })
      .eq("id", selected.id);
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success(`Access revoked for ${selected.email}`);
    setSelected({ ...selected, subscription_tier: "free", subscription_status: "inactive" });
    qc.invalidateQueries({ queryKey: ["admin-members"] });
  }

  const isActive = selected?.subscription_status === "active";

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-3xl font-black tracking-tight">Manual Access</h1>
        <p className="text-muted-foreground mt-1">
          Grant or revoke membership for someone who paid you directly.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
          Search member by email or name
        </p>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-10"
            value={q}
            onChange={(e) => { setQ(e.target.value); setSelected(null); }}
            placeholder="jane@example.com"
          />
        </div>
        {q.length >= 2 && (
          <div className="border border-border rounded-lg divide-y divide-border max-h-64 overflow-auto">
            {isFetching && (
              <div className="p-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin inline mr-2" />Searching…
              </div>
            )}
            {results?.map((p: any) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelected(p)}
                className={`w-full text-left p-3 hover:bg-muted/40 transition-colors ${selected?.id === p.id ? "bg-muted/60" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm">{p.display_name || p.full_name || "—"}</div>
                    <div className="text-xs text-muted-foreground">{p.email}</div>
                  </div>
                  <Badge variant={p.subscription_status === "active" ? "default" : "secondary"}>
                    {p.subscription_status || "inactive"}
                  </Badge>
                </div>
              </button>
            ))}
            {results?.length === 0 && !isFetching && (
              <div className="p-3 text-sm text-muted-foreground">No users found.</div>
            )}
          </div>
        )}
      </div>

      {selected && (
        <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold">{selected.display_name || selected.full_name || "—"}</p>
              <p className="text-sm text-muted-foreground">{selected.email}</p>
            </div>
            <Badge variant={isActive ? "default" : "secondary"}>
              {isActive ? "Active" : "Inactive"}
            </Badge>
          </div>

          <div className="flex gap-3">
            <Button
              onClick={grantAccess}
              disabled={submitting || isActive}
              className="flex-1"
            >
              {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <UserCheck className="h-4 w-4 mr-2" />}
              Grant Access
            </Button>
            <Button
              onClick={revokeAccess}
              disabled={submitting || !isActive}
              variant="destructive"
              className="flex-1"
            >
              {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <UserX className="h-4 w-4 mr-2" />}
              Revoke Access
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Granting access sets their plan to <strong>Artist</strong> with active status — same as a paid subscriber. Revoking resets them to the free tier.
          </p>
        </div>
      )}
    </div>
  );
}
