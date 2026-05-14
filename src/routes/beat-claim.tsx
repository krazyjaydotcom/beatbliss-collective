import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { type FormEvent, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Check, Clock, Loader2, Lock, Mail, Music, Search } from "lucide-react";
import { toast } from "sonner";
import { KrazyLogo } from "@/components/krazy-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/beat-claim")({
  validateSearch: (s: Record<string, unknown>): { beat?: string; source?: string } => ({
    beat: typeof s.beat === "string" ? s.beat : undefined,
    source: typeof s.source === "string" ? s.source : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Choose Your Beat - MYBEATCATALOG" },
      { name: "description", content: "Choose one beat and unlock a private offer window." },
    ],
  }),
  component: BeatClaimPage,
});

type ClaimableBeat = {
  id: string;
  title: string;
  producer_name: string | null;
  genre: string | null;
  mood: string | null;
  music_key: string | null;
  bpm: number | null;
  duration_seconds: number | null;
  cover_url: string | null;
  audio_url: string | null;
  audio_url_tagged: string | null;
  created_at: string;
};

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function beatMeta(beat: Pick<ClaimableBeat, "genre" | "mood" | "bpm">) {
  return [beat.genre, beat.mood, beat.bpm ? String(beat.bpm) + " BPM" : null].filter(Boolean).join(" / ");
}

function BeatClaimPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [selectedId, setSelectedId] = useState("");
  const [email, setEmail] = useState("");
  const [filter, setFilter] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const beatsQuery = useQuery({
    queryKey: ["claimable-beats"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("list_claimable_beats");
      if (error) throw error;
      return (data ?? []) as ClaimableBeat[];
    },
  });

  const beats = beatsQuery.data ?? [];
  const preselectedBeat = useMemo(() => {
    if (!search.beat || !beats.length) return null;
    const requested = search.beat.toLowerCase();
    return beats.find((beat) => beat.id === search.beat || slugify(beat.title) === requested) ?? null;
  }, [beats, search.beat]);

  const effectiveSelectedId = selectedId || preselectedBeat?.id || "";
  const selectedBeat = beats.find((beat) => beat.id === effectiveSelectedId) ?? null;
  const visibleBeats = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return beats;
    return beats.filter((beat) => [beat.title, beat.genre, beat.mood, String(beat.bpm ?? "")].join(" ").toLowerCase().includes(q));
  }, [beats, filter]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedBeat) {
      toast.error("Choose the beat you want first.");
      return;
    }
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return;

    setSubmitting(true);
    try {
      const { data, error } = await (supabase as any).rpc("claim_beat", {
        _email: cleanEmail,
        _beat_id: selectedBeat.id,
        _source: search.source ?? null,
      });
      if (error) throw error;
      const claim = Array.isArray(data) ? data[0] : data;
      if (!claim?.token) throw new Error("Claim could not be created.");
      navigate({ to: "/offer/$token", params: { token: claim.token } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to reserve this beat.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/80 bg-background/90 backdrop-blur">
        <div className="container mx-auto flex items-center justify-between px-6 py-5">
          <Link to="/" aria-label="MYBEATCATALOG home">
            <KrazyLogo className="text-xl" />
          </Link>
          <Button variant="heroOutline" size="sm" asChild>
            <Link to="/login">Member Login</Link>
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-6 py-10 lg:py-14">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-start">
          <section>
            <Badge variant="secondary" className="border border-primary/30 bg-primary/10 text-primary">
              PRIVATE BEAT CLAIM
            </Badge>
            <h1 className="mt-5 max-w-3xl text-4xl font-black leading-tight tracking-tight md:text-6xl">
              Choose the beat you want. <span className="text-primary">One private window.</span>
            </h1>
            <p className="mt-4 max-w-2xl text-muted-foreground md:text-lg">
              Pick one beat, enter your email, and I will reserve that beat with a private 12-hour access page.
            </p>

            <div className="mt-8 flex flex-wrap gap-3 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-2"><Music className="h-4 w-4 text-primary" /> Select one beat</span>
              <span className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-2"><Mail className="h-4 w-4 text-primary" /> Enter your email</span>
              <span className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-2"><Clock className="h-4 w-4 text-primary" /> 12-hour offer page</span>
            </div>

            <div className="mt-8 rounded-2xl border border-border bg-card p-4">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search by title, mood, genre, or BPM" className="pl-9" />
              </label>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {beatsQuery.isLoading ? (
                <div className="col-span-full flex items-center gap-2 rounded-2xl border border-border bg-card p-6 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading beats...
                </div>
              ) : visibleBeats.length === 0 ? (
                <div className="col-span-full rounded-2xl border border-border bg-card p-6 text-muted-foreground">
                  No claimable beats found.
                </div>
              ) : (
                visibleBeats.map((beat) => {
                  const active = effectiveSelectedId === beat.id;
                  return (
                    <button
                      key={beat.id}
                      type="button"
                      onClick={() => setSelectedId(beat.id)}
                      className={"group overflow-hidden rounded-2xl border bg-card text-left transition hover:border-primary/60 " + (active ? "border-primary shadow-[var(--shadow-glow)]" : "border-border")}
                    >
                      <div className="aspect-square bg-muted">
                        {beat.cover_url ? (
                          <img src={beat.cover_url} alt={beat.title} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center"><Music className="h-10 w-10 text-muted-foreground" /></div>
                        )}
                      </div>
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <h2 className="font-bold leading-tight">{beat.title}</h2>
                          {active ? <Check className="h-5 w-5 shrink-0 text-primary" /> : null}
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">{beatMeta(beat)}</p>
                        {beat.audio_url_tagged || beat.audio_url ? (
                          <audio controls preload="none" src={beat.audio_url_tagged ?? beat.audio_url ?? undefined} className="mt-4 w-full" />
                        ) : null}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </section>

          <aside className="lg:sticky lg:top-6">
            <form onSubmit={handleSubmit} className="rounded-3xl border border-primary/60 bg-card p-6 shadow-[var(--shadow-glow)]">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-primary/30 bg-primary/10">
                  <Lock className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-black">Reserve Your Beat</h2>
                  <p className="text-sm text-muted-foreground">Your choice locks after submit.</p>
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-border bg-background/50 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Selected Beat</p>
                <p className="mt-2 font-bold">{selectedBeat ? selectedBeat.title : "Choose one beat"}</p>
                {selectedBeat ? <p className="mt-1 text-xs text-muted-foreground">{beatMeta(selectedBeat)}</p> : null}
              </div>

              <label className="mt-5 block">
                <span className="text-sm font-medium">Email address</span>
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="mt-2"
                />
              </label>

              <Button type="submit" variant="hero" size="lg" className="mt-6 w-full" disabled={submitting || !selectedBeat}>
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Send Me My Private Page
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <p className="mt-4 text-center text-xs text-muted-foreground">
                One beat selection per active 12-hour window.
              </p>
            </form>
          </aside>
        </div>
      </main>
    </div>
  );
}
