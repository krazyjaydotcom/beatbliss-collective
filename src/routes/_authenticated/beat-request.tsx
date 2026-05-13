import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Music2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/beat-request")({
  component: BeatRequestPage,
});

function BeatRequestPage() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const qc = useQueryClient();
  const [style, setStyle] = useState("");
  const [referenceArtists, setReferenceArtists] = useState("");
  const [tempo, setTempo] = useState("mid");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const monthRange = useMemo(() => {
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    return { start: start.toISOString(), end: end.toISOString() };
  }, []);

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["beat-request-profile", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("subscription_status, display_name, full_name")
        .eq("id", userId as string)
        .maybeSingle();
      if (error) throw error;
      return data as { subscription_status: string | null; display_name: string | null; full_name: string | null } | null;
    },
  });

  const { data: existingRequest, isLoading: requestLoading } = useQuery({
    queryKey: ["beat-request", userId, monthRange.start],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("beat_requests")
        .select("*")
        .eq("user_id", userId as string)
        .gte("created_at", monthRange.start)
        .lt("created_at", monthRange.end)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  if (!userId) return null;

  const active = profile?.subscription_status === "active";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!style.trim()) {
      toast.error("Please describe the style or vibe you want.");
      return;
    }
    setSubmitting(true);
    const { error } = await (supabase as any).from("beat_requests").insert({
      user_id: userId,
      style: style.trim(),
      reference_artists: referenceArtists.trim(),
      tempo,
      notes: notes.trim(),
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message || "Unable to submit request.");
      return;
    }
    toast.success("Beat request submitted.");
    setStyle("");
    setReferenceArtists("");
    setTempo("mid");
    setNotes("");
    qc.invalidateQueries({ queryKey: ["beat-request", userId, monthRange.start] });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Music2 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight">Monthly Beat Request</h1>
            <p className="text-sm text-muted-foreground">One custom request per calendar month for active members.</p>
          </div>
        </div>
      </div>

      {profileLoading || requestLoading ? (
        <div className="flex items-center gap-2 rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading your request status…
        </div>
      ) : !active ? (
        <div className="rounded-3xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold">Membership required</h2>
          <p className="mt-2 text-sm text-muted-foreground">Beat requests are available only when subscription_status is active.</p>
        </div>
      ) : existingRequest ? (
        <div className="rounded-3xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold">You've already submitted your request this month. Check back next month.</h2>
          <div className="mt-4 space-y-2 text-sm text-muted-foreground">
            <p><span className="font-medium text-foreground">Style:</span> {existingRequest.style}</p>
            <p><span className="font-medium text-foreground">Tempo:</span> {existingRequest.tempo}</p>
            <p><span className="font-medium text-foreground">Status:</span> {existingRequest.status}</p>
            <p><span className="font-medium text-foreground">Submitted:</span> {new Date(existingRequest.created_at).toLocaleString()}</p>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6 rounded-3xl border border-border bg-card p-6">
          <div className="space-y-2">
            <Label htmlFor="style">Style / vibe description</Label>
            <Textarea id="style" value={style} onChange={(e) => setStyle(e.target.value)} rows={6} placeholder="Describe the emotion, message, instruments, and overall vibe you want." />
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="artists">Reference artists</Label>
              <Input id="artists" value={referenceArtists} onChange={(e) => setReferenceArtists(e.target.value)} placeholder="Artist names or songs for reference" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tempo">Tempo preference</Label>
              <select
                id="tempo"
                value={tempo}
                onChange={(e) => setTempo(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="slow">slow</option>
                <option value="mid">mid</option>
                <option value="uptempo radio">uptempo radio</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Additional notes</Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder="Anything else KrazyJay should know before building the beat." />
          </div>

          <Button type="submit" disabled={submitting}>
            {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting…</> : "Submit Beat Request"}
          </Button>
        </form>
      )}
    </div>
  );
}
