import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, ShieldCheck, ExternalLink, Sparkles } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { SiteNav } from "@/components/site-nav";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/whitelist")({
  head: () => ({ meta: [{ title: "Whitelist Submissions — KRAZYJAYDOTCOM" }] }),
  component: WhitelistPage,
});

const submissionSchema = z.object({
  track_title: z.string().trim().min(1, "Track title required").max(120),
  artist_name: z.string().trim().min(1, "Artist name required").max(120),
  streaming_url: z.string().trim().url("Must be a valid URL").max(500),
  release_date: z.string().optional(),
  notes: z.string().trim().max(1000).optional(),
});

const STATUS_VARIANT: Record<string, "secondary" | "default" | "destructive"> = {
  pending: "secondary",
  approved: "default",
  rejected: "destructive",
};

function WhitelistPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tier, setTier] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [form, setForm] = useState({ track_title: "", artist_name: "", streaming_url: "", release_date: "", notes: "" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("subscription_tier, subscription_status")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setTier(data?.subscription_tier ?? "none");
        setStatus(data?.subscription_status ?? null);
      });
  }, [user]);

  const isPaid = tier && tier !== "none" && (status === "active" || status === "trialing" || status === "past_due");

  const { data: submissions = [], isLoading } = useQuery({
    queryKey: ["my-whitelist", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whitelist_submissions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const parsed = submissionSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("whitelist_submissions").insert({
      user_id: user.id,
      track_title: parsed.data.track_title,
      artist_name: parsed.data.artist_name,
      streaming_url: parsed.data.streaming_url,
      release_date: parsed.data.release_date || null,
      notes: parsed.data.notes || null,
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Submission received — we'll review it shortly.");
    setForm({ track_title: "", artist_name: "", streaming_url: "", release_date: "", notes: "" });
    qc.invalidateQueries({ queryKey: ["my-whitelist"] });
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <main className="container mx-auto px-6 pt-32 pb-20 max-w-3xl">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-7 w-7 text-electric" />
          <h1 className="text-4xl font-black tracking-tight">Whitelist a Track</h1>
        </div>
        <p className="mt-2 text-muted-foreground">
          Submit songs you've released using KRAZYJAY beats. Approved tracks get cleared from any DMCA / monetization claim on streaming platforms.
        </p>

        {!isPaid ? (
          <div className="mt-10 rounded-2xl border border-electric/40 bg-electric/5 p-8 text-center">
            <Sparkles className="h-10 w-10 text-electric mx-auto mb-3" />
            <h2 className="text-2xl font-bold">Members only</h2>
            <p className="mt-2 text-muted-foreground">
              Whitelist submissions are part of the Unlimited Membership License — available on the Artist and Label plans.
            </p>
            <Button variant="hero" className="mt-6" asChild>
              <Link to="/" hash="pricing">Upgrade to submit</Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-10 rounded-2xl border border-border bg-card p-6 space-y-4">
            <h2 className="font-semibold">New submission</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Track title *</Label>
                <Input value={form.track_title} onChange={(e) => setForm({ ...form, track_title: e.target.value })} maxLength={120} required />
              </div>
              <div className="space-y-1.5">
                <Label>Artist name *</Label>
                <Input value={form.artist_name} onChange={(e) => setForm({ ...form, artist_name: e.target.value })} maxLength={120} required />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label>Streaming link *</Label>
                <Input type="url" placeholder="https://open.spotify.com/track/…" value={form.streaming_url} onChange={(e) => setForm({ ...form, streaming_url: e.target.value })} maxLength={500} required />
              </div>
              <div className="space-y-1.5">
                <Label>Release date</Label>
                <Input type="date" value={form.release_date} onChange={(e) => setForm({ ...form, release_date: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Which beat did you use? Any extra context?" maxLength={1000} rows={3} />
            </div>
            <Button type="submit" variant="hero" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Submit for whitelist
            </Button>
          </form>
        )}

        <div className="mt-12">
          <h2 className="text-xl font-bold mb-4">Your submissions</h2>
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : submissions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No submissions yet.</p>
          ) : (
            <div className="space-y-3">
              {submissions.map((s: any) => (
                <div key={s.id} className="rounded-xl border border-border bg-card p-4 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{s.track_title} <span className="text-muted-foreground font-normal">— {s.artist_name}</span></div>
                    <a href={s.streaming_url} target="_blank" rel="noreferrer" className="text-xs text-electric hover:underline inline-flex items-center gap-1 mt-1">
                      <ExternalLink className="h-3 w-3" /> {s.streaming_url}
                    </a>
                    {s.admin_notes && <p className="text-xs text-muted-foreground mt-2">Admin: {s.admin_notes}</p>}
                  </div>
                  <Badge variant={STATUS_VARIANT[s.status] ?? "secondary"}>{s.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
