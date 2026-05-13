import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Link2, Loader2, MailPlus, Search, UserCheck, UserX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { getStripeEnvironment } from "@/lib/stripe";
import { createManualInvite } from "@/lib/invites.functions";

export const Route = createFileRoute("/_authenticated/admin/access")({
  head: () => ({ meta: [{ title: "Admin · Manual Access - MYBEATCATALOG" }] }),
  component: AdminAccessPage,
});

type InviteTier = "artist" | "label";

interface InviteLinkResult {
  ok: true;
  email: string;
  tier: InviteTier;
  tierLabel: string;
  expiresAt: string;
  reused: boolean;
  url: string;
}

function AdminAccessPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<any | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteTier, setInviteTier] = useState<InviteTier>("artist");
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [inviteResult, setInviteResult] = useState<InviteLinkResult | null>(null);
  const createInvite = useServerFn(createManualInvite);

  const { data: results, isFetching } = useQuery({
    queryKey: ["access-search", q],
    enabled: q.length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, display_name, full_name, subscription_tier, subscription_status")
        .or("email.ilike.%" + q + "%,display_name.ilike.%" + q + "%,full_name.ilike.%" + q + "%")
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  async function createInviteLink() {
    const email = inviteEmail.trim();
    if (!email) {
      toast.error("Enter an email address first.");
      return;
    }

    setInviteSubmitting(true);
    try {
      const result = await createInvite({
        data: {
          email,
          tier: inviteTier,
          origin: window.location.origin,
          environment: getStripeEnvironment(),
        },
      });
      setInviteResult(result);
      toast.success(result.reused ? "Open invite link is ready to copy." : "Invite link created.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create invite link.");
    } finally {
      setInviteSubmitting(false);
    }
  }

  async function copyInviteLink() {
    if (!inviteResult) return;
    await navigator.clipboard.writeText(inviteResult.url);
    toast.success("Invite link copied.");
  }

  async function grantAccess() {
    if (!selected) return;
    setSubmitting(true);
    const { error } = await supabase
      .from("profiles")
      .update({ subscription_tier: "artist", subscription_status: "active" })
      .eq("id", selected.id);
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Access granted to " + selected.email);
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
    toast.success("Access revoked for " + selected.email);
    setSelected({ ...selected, subscription_tier: "free", subscription_status: "inactive" });
    qc.invalidateQueries({ queryKey: ["admin-members"] });
  }

  const isActive = selected?.subscription_status === "active";

  return (
    <div className="max-w-5xl space-y-8">
      <div>
        <h1 className="text-3xl font-black tracking-tight">Manual Access</h1>
        <p className="mt-1 text-muted-foreground">
          Create private claim links for new users, or grant and revoke membership on existing profiles.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
                Private invite links
              </p>
              <h2 className="mt-2 text-xl font-bold">Create a claim URL</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Use this for approved users or direct-pay members who should set up an account without public signup.
              </p>
            </div>
            <Badge variant="secondary">Invite-only</Badge>
          </div>

          <div className="space-y-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Email address</label>
              <Input
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder="artist@example.com"
                type="email"
              />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Invite tier</p>
              <div className="flex gap-2">
                {(["artist", "label"] as const).map((tier) => (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => setInviteTier(tier)}
                    className={
                      inviteTier === tier
                        ? "rounded-lg border border-primary bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                        : "rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
                    }
                  >
                    {tier === "artist" ? "Artist" : "Label"}
                  </button>
                ))}
              </div>
            </div>

            <Button onClick={createInviteLink} disabled={inviteSubmitting} className="w-full">
              {inviteSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <MailPlus className="mr-2 h-4 w-4" />
              )}
              {inviteSubmitting ? "Creating link..." : "Create invite link"}
            </Button>
          </div>

          {inviteResult && (
            <div className="rounded-2xl border border-border bg-muted/30 p-4 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">
                    {inviteResult.reused ? "Existing open invite" : "Fresh invite created"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {inviteResult.email} · {inviteResult.tierLabel} · expires{" "}
                    {new Date(inviteResult.expiresAt).toLocaleDateString()}
                  </p>
                </div>
                <Badge variant="outline">1-time link</Badge>
              </div>

              <div className="rounded-xl border border-border bg-background px-3 py-3 font-mono text-xs break-all text-muted-foreground">
                {inviteResult.url}
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button type="button" variant="outline" onClick={copyInviteLink} className="flex-1">
                  <Copy className="mr-2 h-4 w-4" />
                  Copy link
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => window.open(inviteResult.url, "_blank", "noopener,noreferrer")}
                >
                  <Link2 className="mr-2 h-4 w-4" />
                  Open claim page
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">Existing profiles</p>
            <h2 className="mt-2 text-xl font-bold">Grant or revoke member access</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Search an existing profile when someone already has an account and only needs their membership status
              changed.
            </p>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-10"
              value={q}
              onChange={(event) => {
                setQ(event.target.value);
                setSelected(null);
              }}
              placeholder="Search by email or name"
            />
          </div>

          {q.length >= 2 && (
            <div className="max-h-64 overflow-auto rounded-lg border border-border divide-y divide-border">
              {isFetching && (
                <div className="p-3 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  Searching...
                </div>
              )}
              {results?.map((profile: any) => (
                <button
                  key={profile.id}
                  type="button"
                  onClick={() => setSelected(profile)}
                  className={
                    selected?.id === profile.id
                      ? "w-full bg-muted/60 p-3 text-left transition-colors"
                      : "w-full p-3 text-left transition-colors hover:bg-muted/40"
                  }
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-sm font-medium">{profile.display_name || profile.full_name || "-"}</div>
                      <div className="text-xs text-muted-foreground">{profile.email}</div>
                    </div>
                    <Badge variant={profile.subscription_status === "active" ? "default" : "secondary"}>
                      {profile.subscription_status || "inactive"}
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
      </div>

      {selected && (
        <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-semibold">{selected.display_name || selected.full_name || "-"}</p>
              <p className="text-sm text-muted-foreground">{selected.email}</p>
            </div>
            <Badge variant={isActive ? "default" : "secondary"}>{isActive ? "Active" : "Inactive"}</Badge>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button onClick={grantAccess} disabled={submitting || isActive} className="flex-1">
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserCheck className="mr-2 h-4 w-4" />}
              Grant Access
            </Button>
            <Button onClick={revokeAccess} disabled={submitting || !isActive} variant="destructive" className="flex-1">
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserX className="mr-2 h-4 w-4" />}
              Revoke Access
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Granting access sets their profile to the Artist tier with active status. Revoking access moves them back to
            the free tier.
          </p>
        </div>
      )}
    </div>
  );
}
