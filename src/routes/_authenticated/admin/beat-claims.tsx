import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Clock, Copy, Loader2, Music, TimerOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/admin/beat-claims")({
  component: AdminBeatClaimsPage,
});

type ClaimRow = {
  id: string;
  email: string;
  token: string;
  source: string | null;
  expires_at: string;
  created_at: string;
  purchased_at: string | null;
  checkout_session_id: string | null;
  ip_address?: string | null;
  device_fingerprint?: string | null;
  beats?: {
    title: string;
    genre: string | null;
    mood: string | null;
    bpm: number | null;
    cover_url: string | null;
  } | null;
};

function AdminBeatClaimsPage() {
  const claimsQ = useQuery({
    queryKey: ["admin-beat-claims"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("beat_claims")
        .select("id, email, token, source, expires_at, created_at, purchased_at, checkout_session_id, ip_address, device_fingerprint, beats(title, genre, mood, bpm, cover_url)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ClaimRow[];
    },
  });

  const claims = claimsQ.data ?? [];
  const active = claims.filter((claim) => !claim.purchased_at && new Date(claim.expires_at).getTime() > Date.now()).length;
  const purchased = claims.filter((claim) => claim.purchased_at).length;
  const expired = claims.filter((claim) => !claim.purchased_at && new Date(claim.expires_at).getTime() <= Date.now()).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Beat Claims</h1>
          <p className="mt-1 text-muted-foreground">Track IG funnel leads, selected beats, private offer links, and purchase status.</p>
        </div>
        <Button variant="hero" asChild>
          <a href="/beat-claim" target="_blank" rel="noreferrer">Open Claim Page</a>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat icon={Clock} label="Active windows" value={active} />
        <Stat icon={CheckCircle2} label="Purchased" value={purchased} />
        <Stat icon={TimerOff} label="Expired" value={expired} />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-950 shadow-sm">
        {claimsQ.isLoading ? (
          <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading beat claims...
          </div>
        ) : claims.length === 0 ? (
          <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
            <Music className="h-4 w-4" /> No beat claims yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-100 text-left text-xs uppercase tracking-[0.2em] text-slate-600">
                <tr>
                  <th className="px-4 py-3">Lead</th>
                  <th className="px-4 py-3">Beat</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Expires</th>
                  <th className="px-4 py-3">Source</th><th className="px-4 py-3">Guardrails</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {claims.map((claim) => <ClaimRow key={claim.id} claim={claim} />)}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function ClaimRow({ claim }: { claim: ClaimRow }) {
  const expired = !claim.purchased_at && new Date(claim.expires_at).getTime() <= Date.now();
  const status = claim.purchased_at ? "purchased" : expired ? "expired" : "active";
  const badgeClass = status === "purchased"
    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
    : status === "active"
    ? "border-primary/40 bg-primary/10 text-primary"
    : "border-amber-500/40 bg-amber-500/10 text-amber-400";
  const url = typeof window !== "undefined" ? window.location.origin + "/offer/" + claim.token : "/offer/" + claim.token;
  const beat = claim.beats;
  const meta = beat ? [beat.genre, beat.mood, beat.bpm ? String(beat.bpm) + " BPM" : null].filter(Boolean).join(" / ") : "";

  return (
    <tr className="border-b border-slate-200 align-top hover:bg-slate-50">
      <td className="px-4 py-4">
        <div className="font-medium">{claim.email}</div>
        <div className="mt-1 max-w-[240px] truncate text-xs text-slate-600">{url}</div>
      </td>
      <td className="px-4 py-4">
        <div className="flex items-center gap-3">
          {beat?.cover_url ? <img src={beat.cover_url} alt={beat.title} className="h-10 w-10 rounded-md border border-border object-cover" /> : null}
          <div>
            <div className="font-medium">{beat?.title ?? "Beat removed"}</div>
            {meta ? <div className="text-xs text-slate-600">{meta}</div> : null}
          </div>
        </div>
      </td>
      <td className="px-4 py-4"><span className={"rounded-full border px-2 py-1 text-xs " + badgeClass}>{status}</span></td>
      <td className="px-4 py-4 text-slate-600">{new Date(claim.created_at).toLocaleString()}</td>
      <td className="px-4 py-4 text-slate-600">{new Date(claim.expires_at).toLocaleString()}</td>
      <td className="px-4 py-4 text-slate-600">{claim.source ?? "-"}</td>
      <td className="px-4 py-4 text-xs text-slate-600">
        <div>{claim.ip_address ? "IP: " + claim.ip_address : "IP: -"}</div>
        <div className="mt-1 max-w-[180px] truncate">{claim.device_fingerprint ? "Device: " + claim.device_fingerprint : "Device: -"}</div>
      </td>
      <td className="px-4 py-4">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              toast.success("Offer link copied.");
            } catch {
              toast.error("Copy failed.");
            }
          }}
        >
          <Copy className="mr-2 h-4 w-4" />
          Copy
        </Button>
      </td>
    </tr>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 text-slate-950 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <p className="mt-3 text-3xl font-black">{value}</p>
    </div>
  );
}
