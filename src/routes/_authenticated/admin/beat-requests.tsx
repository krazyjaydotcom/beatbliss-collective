import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Music2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin/beat-requests")({
  component: AdminBeatRequestsPage,
});

function AdminBeatRequestsPage() {
  const qc = useQueryClient();

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["admin-beat-requests"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("beat_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as any[];
      const userIds = Array.from(new Set(rows.map((row) => row.user_id).filter(Boolean)));
      let profileMap: Record<string, { name: string; email: string }> = {};
      if (userIds.length) {
        const { data: profiles, error: profileError } = await supabase
          .from("profiles")
          .select("id, display_name, full_name, email")
          .in("id", userIds);
        if (profileError) throw profileError;
        profileMap = Object.fromEntries((profiles ?? []).map((profile: any) => [
          profile.id,
          {
            name: profile.display_name || profile.full_name || profile.email || "Unknown member",
            email: profile.email || "—",
          },
        ]));
      }
      return rows.map((row) => ({
        ...row,
        member_name: profileMap[row.user_id]?.name || row.user_id,
        member_email: profileMap[row.user_id]?.email || "—",
      }));
    },
  });

  async function updateStatus(id: string, status: string) {
    const { error } = await (supabase as any).from("beat_requests").update({ status }).eq("id", id);
    if (error) {
      toast.error(error.message || "Unable to update request.");
      return;
    }
    toast.success("Request updated.");
    qc.invalidateQueries({ queryKey: ["admin-beat-requests"] });
  }

  async function deleteRequest(id: string, memberName: string) {
    if (!confirm(`Delete this beat request from ${memberName}?`)) return;
    const { error } = await (supabase as any).rpc("admin_delete_beat_request", { _id: id });
    if (error) {
      toast.error(error.message || "Unable to delete request.");
      return;
    }
    toast.success("Beat request deleted.");
    qc.invalidateQueries({ queryKey: ["admin-beat-requests"] });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight">Beat Requests</h1>
        <p className="mt-1 text-muted-foreground">Review member requests and update production status.</p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {isLoading ? (
          <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading beat requests…
          </div>
        ) : requests.length === 0 ? (
          <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
            <Music2 className="h-4 w-4" />
            No beat requests yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-border bg-muted/30 text-left text-xs uppercase tracking-[0.2em] text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Member</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Style</th>
                  <th className="px-4 py-3">Tempo</th>
                  <th className="px-4 py-3">Reference artists</th>
                  <th className="px-4 py-3">Notes</th>
                  <th className="px-4 py-3">Date submitted</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request: any) => (
                  <tr key={request.id} className="border-b border-border/70 align-top">
                    <td className="px-4 py-4 font-medium">{request.member_name}</td>
                    <td className="px-4 py-4 text-muted-foreground">{request.member_email}</td>
                    <td className="px-4 py-4 whitespace-pre-wrap">{request.style}</td>
                    <td className="px-4 py-4">{request.tempo || "—"}</td>
                    <td className="px-4 py-4 whitespace-pre-wrap text-muted-foreground">{request.reference_artists || "—"}</td>
                    <td className="px-4 py-4 whitespace-pre-wrap text-muted-foreground">{request.notes || "—"}</td>
                    <td className="px-4 py-4 text-muted-foreground">{new Date(request.created_at).toLocaleString()}</td>
                    <td className="px-4 py-4">
                      <select
                        value={request.status || "pending"}
                        onChange={(e) => updateStatus(request.id, e.target.value)}
                        className="flex h-9 rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        <option value="pending">pending</option>
                        <option value="in progress">in progress</option>
                        <option value="completed">completed</option>
                      </select>
                    </td>
                    <td className="px-4 py-4">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => deleteRequest(request.id, request.member_name)}
                        className="border-red-500/30 text-red-300 hover:bg-red-500/10 hover:text-red-100"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
