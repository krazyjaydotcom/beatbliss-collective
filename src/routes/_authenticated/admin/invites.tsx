import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { Copy, Link2, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin/invites")({
  component: AdminInvitesPage,
});

const INVITE_BASE = "https://mybeatcatalog.com/join/";

function makeToken() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().replace(/-/g, "") + Math.random().toString(36).slice(2, 10);
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function AdminInvitesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: invites = [], isLoading } = useQuery({
    queryKey: ["admin-invites"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invites")
        .select("id, token, created_by, used_by, used_at, created_at, expires_at, revoked_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as any[];
      const ids = Array.from(
        new Set(rows.flatMap((r) => [r.created_by, r.used_by]).filter(Boolean) as string[]),
      );
      let map: Record<string, { name: string; email: string }> = {};
      if (ids.length) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, display_name, full_name, email")
          .in("id", ids);
        map = Object.fromEntries(
          (profiles ?? []).map((p: any) => [
            p.id,
            {
              name: p.display_name || p.full_name || p.email || p.id,
              email: p.email || "—",
            },
          ]),
        );
      }
      return rows.map((r) => ({ ...r, _profiles: map }));
    },
  });

  async function generateInvite() {
    if (!user) return;
    const token = makeToken();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await (supabase as any).from("invites").insert({
      token,
      created_by: user.id,
      expires_at: expiresAt,
    });
    if (error) {
      toast.error(error.message || "Unable to create invite.");
      return;
    }
    const url = INVITE_BASE + token;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Invite link copied to clipboard.");
    } catch {
      toast.success("Invite created.");
    }
    qc.invalidateQueries({ queryKey: ["admin-invites"] });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Invites</h1>
          <p className="mt-1 text-muted-foreground">
            Generate invite links. Each link grants free active member access on signup.
          </p>
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
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Expires</th>
                  <th className="px-4 py-3">Used By</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {invites.map((invite: any) => {
                  const url = INVITE_BASE + invite.token;
                  const expired = !invite.used_at && new Date(invite.expires_at) < new Date();
                  const status = invite.revoked_at
                    ? "revoked"
                    : invite.used_at
                    ? "used"
                    : expired
                    ? "expired"
                    : "unused";
                  const usedBy = invite.used_by ? invite._profiles[invite.used_by] : null;
                  return (
                    <InviteRow
                      key={invite.id}
                      url={url}
                      status={status}
                      createdAt={invite.created_at}
                      expiresAt={invite.expires_at}
                      usedAt={invite.used_at}
                      usedBy={usedBy}
                    />
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

function InviteRow({
  url,
  status,
  createdAt,
  expiresAt,
  usedAt,
  usedBy,
}: {
  url: string;
  status: "unused" | "used" | "expired" | "revoked";
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
  usedBy: { name: string; email: string } | null;
}) {
  const badge = useMemo(() => {
    const map: Record<string, string> = {
      unused: "border-primary/40 bg-primary/10 text-primary",
      used: "border-border text-muted-foreground",
      expired: "border-amber-500/40 bg-amber-500/10 text-amber-500",
      revoked: "border-destructive/40 bg-destructive/10 text-destructive",
    };
    return map[status];
  }, [status]);

  return (
    <tr className="border-b border-border/70 align-top">
      <td className="px-4 py-4">
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={url}
            onFocus={(e) => e.currentTarget.select()}
            className="w-[320px] max-w-full truncate rounded-md border border-border bg-background px-2 py-1 text-xs"
          />
        </div>
      </td>
      <td className="px-4 py-4">
        <span className={`rounded-full border px-2 py-1 text-xs ${badge}`}>{status}</span>
      </td>
      <td className="px-4 py-4 text-muted-foreground">{new Date(createdAt).toLocaleDateString()}</td>
      <td className="px-4 py-4 text-muted-foreground">
        {new Date(expiresAt).toLocaleDateString()}
      </td>
      <td className="px-4 py-4">
        {usedBy ? (
          <>
            <div className="font-medium">{usedBy.name}</div>
            <div className="text-xs text-muted-foreground">{usedBy.email}</div>
            {usedAt && (
              <div className="text-xs text-muted-foreground">
                {new Date(usedAt).toLocaleString()}
              </div>
            )}
          </>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-4 py-4">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              toast.success("Link copied.");
            } catch {
              toast.error("Copy failed.");
            }
          }}
        >
          <Copy className="mr-2 h-4 w-4" />
          Copy Link
        </Button>
      </td>
    </tr>
  );
}
