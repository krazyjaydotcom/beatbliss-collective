import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Link2, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin/invites")({
  component: AdminInvitesPage,
});

function AdminInvitesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: invites = [], isLoading } = useQuery({
    queryKey: ["admin-invites"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("invites")
        .select("id, token, created_by, used_by, used_at, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as any[];
      const profileIds = Array.from(new Set(rows.flatMap((row) => [row.created_by, row.used_by]).filter(Boolean)));
      let profilesById: Record<string, { name: string; email: string }> = {};
      if (profileIds.length) {
        const { data: profiles, error: profileError } = await supabase
          .from("profiles")
          .select("id, display_name, full_name, email")
          .in("id", profileIds);
        if (profileError) throw profileError;
        profilesById = Object.fromEntries((profiles ?? []).map((profile: any) => [
          profile.id,
          {
            name: profile.display_name || profile.full_name || profile.email || profile.id,
            email: profile.email || "—",
          },
        ]));
      }
      return rows.map((row) => ({
        ...row,
        created_by_name: row.created_by ? profilesById[row.created_by]?.name || row.created_by : "—",
        used_by_name: row.used_by ? profilesById[row.used_by]?.name || row.used_by : "—",
        used_by_email: row.used_by ? profilesById[row.used_by]?.email || "—" : "—",
      }));
    },
  });

  async function generateInvite() {
    if (!user) return;
    const token = crypto.randomUUID().replace(/-/g, "");
    const minimalPayload = { token, created_by: user.id, used_by: null, used_at: null };
    let result = await (supabase as any).from("invites").insert(minimalPayload);
    if (result.error) {
      result = await (supabase as any).from("invites").insert({
        ...minimalPayload,
        email: "invite+" + token + "@invite.local",
        stripe_customer_id: "",
        tier: "artist",
        environment: "live",
        expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      });
    }
    if (result.error) {
      toast.error(result.error.message || "Unable to create invite.");
      return;
    }
    const inviteUrl = window.location.origin + "/invite/" + token;
    await navigator.clipboard.writeText(inviteUrl);
    toast.success("Invite link copied to clipboard.");
    qc.invalidateQueries({ queryKey: ["admin-invites"] });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Invites</h1>
          <p className="mt-1 text-muted-foreground">Generate invite links for approved members and track who used them.</p>
        </div>
        <Button onClick={generateInvite}>
          <Plus className="mr-2 h-4 w-4" />
          Generate Invite Link
        </Button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {isLoading ? (
          <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading invites…
          </div>
        ) : invites.length === 0 ? (
          <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
            <Link2 className="h-4 w-4" />
            No invites generated yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-border bg-muted/30 text-left text-xs uppercase tracking-[0.2em] text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Invite Link</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Created By</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Used By</th>
                  <th className="px-4 py-3">Used At</th>
                  <th className="px-4 py-3">Copy</th>
                </tr>
              </thead>
              <tbody>
                {invites.map((invite: any) => {
                  const inviteUrl = window.location.origin + "/invite/" + invite.token;
                  return (
                    <tr key={invite.id} className="border-b border-border/70 align-top">
                      <td className="px-4 py-4">
                        <div className="max-w-[320px] truncate font-medium">{inviteUrl}</div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={invite.used_at ? "rounded-full border border-border px-2 py-1 text-xs text-foreground" : "rounded-full border border-primary/40 bg-primary/10 px-2 py-1 text-xs text-primary"}>
                          {invite.used_at ? "used" : "unused"}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-muted-foreground">{invite.created_by_name}</td>
                      <td className="px-4 py-4 text-muted-foreground">{new Date(invite.created_at).toLocaleString()}</td>
                      <td className="px-4 py-4">
                        <div className="font-medium">{invite.used_by_name}</div>
                        <div className="text-xs text-muted-foreground">{invite.used_by_email}</div>
                      </td>
                      <td className="px-4 py-4 text-muted-foreground">{invite.used_at ? new Date(invite.used_at).toLocaleString() : "—"}</td>
                      <td className="px-4 py-4">
                        <Button type="button" variant="ghost" size="sm" onClick={() => navigator.clipboard.writeText(inviteUrl)}>
                          <Copy className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
