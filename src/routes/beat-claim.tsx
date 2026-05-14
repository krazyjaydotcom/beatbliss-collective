import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Lock, Mail, Pause, Play, Waves, X } from "lucide-react";
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
      { title: "Pick Your Beat - MYBEATCATALOG" },
      { name: "description", content: "Preview beats, choose one, and open your private offer page." },
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

type ClaimBeatApiResponse = {
  ok: boolean;
  token: string | null;
  offerUrl: string | null;
  expiresAt: string | null;
  sendy?: { configured: boolean; ok: boolean; error?: string };
  sendfox?: { configured: boolean; ok: boolean; error?: string };
  error: string | null;
};

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function formatDuration(seconds: number | null | undefined) {
  const total = Math.max(0, Number(seconds ?? 0));
  if (!total) return "--:--";
  const min = Math.floor(total / 60);
  const sec = Math.floor(total % 60);
  return String(min).padStart(2, "0") + ":" + String(sec).padStart(2, "0");
}

function beatStyle(beat: Pick<ClaimableBeat, "mood" | "genre">) {
  return [beat.mood, beat.genre].filter(Boolean).join(" / ") || "Premium";
}

function beatAudio(beat: ClaimableBeat | null) {
  return beat?.audio_url_tagged || beat?.audio_url || "";
}

function BeatClaimPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [selectedId, setSelectedId] = useState("");
  const [playingId, setPlayingId] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [claimModalOpen, setClaimModalOpen] = useState(false);

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

  useEffect(() => {
    if (!selectedId && preselectedBeat) setSelectedId(preselectedBeat.id);
    if (!selectedId && !preselectedBeat && beats[0]) setSelectedId(beats[0].id);
  }, [beats, preselectedBeat, selectedId]);

  useEffect(() => {
    if (!claimModalOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setClaimModalOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [claimModalOpen]);

  const selectedBeat = beats.find((beat) => beat.id === selectedId) ?? preselectedBeat ?? beats[0] ?? null;
  const playingBeat = beats.find((beat) => beat.id === playingId) ?? selectedBeat;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onEnded = () => setIsPlaying(false);
    audio.addEventListener("ended", onEnded);
    return () => audio.removeEventListener("ended", onEnded);
  }, []);

  useEffect(() => {
    if (!playingBeat) return;
    const audio = audioRef.current;
    if (!audio) return;
    const src = beatAudio(playingBeat);
    if (!src) return;
    audio.src = src;
    audio.load();
    if (isPlaying) audio.play().catch(() => setIsPlaying(false));
  }, [playingBeat?.id]);

  async function playBeat(beat: ClaimableBeat) {
    const audio = audioRef.current;
    if (!audio || !beatAudio(beat)) return;
    setSelectedId(beat.id);
    if (playingId === beat.id && isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }
    setPlayingId(beat.id);
    setIsPlaying(true);
    setTimeout(() => audioRef.current?.play().catch(() => setIsPlaying(false)), 0);
  }

  function openClaimModal(beat: ClaimableBeat) {
    setSelectedId(beat.id);
    setClaimModalOpen(true);
  }

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
      const response = await fetch("/api/public/beat-claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: cleanEmail,
          beatId: selectedBeat.id,
          source: search.source ?? "beat-claim",
          origin: window.location.origin,
        }),
      });
      const result = (await response.json()) as ClaimBeatApiResponse;
      if (!response.ok || !result.ok || !result.token) {
        throw new Error(result.error ?? "Unable to reserve this beat.");
      }
      const provider = result.sendy ?? result.sendfox;
      if (provider?.configured && !provider.ok) {
        toast.message(`Beat reserved, but Sendy needs attention: ${provider.error ?? "unknown error"}`);
      }
      navigate({ to: "/offer/$token", params: { token: result.token } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to reserve this beat.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#02060a] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(37,99,235,0.16),transparent_36%),linear-gradient(180deg,rgba(2,6,10,0.2),#02060a_72%)]" />
      <div className="relative min-h-screen">
        <header className="border-b border-white/10">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
            <Link to="/" aria-label="MYBEATCATALOG home">
              <KrazyLogo className="text-2xl" />
            </Link>
            <div className="hidden items-center gap-3 text-sm font-semibold uppercase tracking-wide text-white md:flex">
              <Waves className="h-5 w-5 text-primary" />
              High Quality Beats
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-5xl px-4 py-7 pb-12 sm:px-5">
          <section className="text-center">
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl md:text-5xl">
              PICK YOUR <span className="text-primary">BEAT</span>
            </h1>
            <p className="mt-3 text-sm text-white/60 sm:text-base">
              Preview the tracks below and claim the one that fits your sound.
            </p>
          </section>

          <section className="mt-7 overflow-hidden rounded-xl border border-white/10 bg-white/[0.025] shadow-2xl shadow-black/30">
            <div className="hidden grid-cols-[44px_1fr_148px_96px_170px_104px] gap-3 border-b border-white/10 px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-white/55 md:grid">
              <span>#</span>
              <span>Track</span>
              <span>Mood / Style</span>
              <span>Duration</span>
              <span>Play</span>
              <span className="text-center">Claim</span>
            </div>

            {beatsQuery.isLoading ? (
              <div className="flex items-center justify-center gap-2 px-6 py-16 text-white/60">
                <Loader2 className="h-5 w-5 animate-spin" /> Loading beats...
              </div>
            ) : beats.length === 0 ? (
              <div className="px-6 py-16 text-center text-white/55">No beats are available yet.</div>
            ) : (
              beats.map((beat, index) => {
                const active = selectedBeat?.id === beat.id;
                const playing = playingBeat?.id === beat.id && isPlaying;
                return (
                  <div
                    key={beat.id}
                    className={
                      "grid grid-cols-[34px_1fr_92px] gap-3 border-b border-white/10 px-4 py-3 transition last:border-b-0 md:grid-cols-[44px_1fr_148px_96px_170px_104px] md:items-center md:px-5 " +
                      (active ? "bg-primary/10 ring-1 ring-inset ring-primary/35" : "hover:bg-white/[0.04]")
                    }
                  >
                    <div className="self-center font-mono text-sm font-bold text-primary md:text-base">
                      {String(index + 1).padStart(2, "0")}
                    </div>

                    <div className="flex min-w-0 items-center gap-3">
                      <button
                        type="button"
                        onClick={() => playBeat(beat)}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/25 text-white transition hover:border-primary hover:text-primary md:h-10 md:w-10"
                        aria-label={(playing ? "Pause " : "Play ") + beat.title}
                      >
                        {playing ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
                      </button>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold sm:text-base">{beat.title}</p>
                        <p className="mt-1 truncate text-xs text-white/45 md:hidden">
                          {beatStyle(beat)} / {formatDuration(beat.duration_seconds)}
                        </p>
                      </div>
                    </div>

                    <div className="hidden md:block">
                      <Badge variant="outline" className="max-w-full truncate border-primary/50 bg-primary/10 text-primary">
                        {beatStyle(beat)}
                      </Badge>
                    </div>
                    <div className="hidden font-mono text-sm text-white/70 md:block">{formatDuration(beat.duration_seconds)}</div>
                    <MiniWave active={active || playing} />
                    <Button
                      type="button"
                      variant={active ? "hero" : "outline"}
                      className="h-10 border-primary/60 px-3 text-sm"
                      onClick={() => openClaimModal(beat)}
                    >
                      Select
                    </Button>
                  </div>
                );
              })
            )}
          </section>

          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-white/55 sm:text-sm">
            <Lock className="h-4 w-4" /> Your email is safe with us. No spam.
          </div>
        </main>
      </div>

      {claimModalOpen && selectedBeat ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="claim-beat-title">
          <div className="relative w-full max-w-md rounded-2xl border border-primary/40 bg-[#05090f] p-6 shadow-[0_0_80px_rgba(37,99,235,0.22)]">
            <button
              type="button"
              onClick={() => setClaimModalOpen(false)}
              className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-white/60 transition hover:border-primary/50 hover:text-white"
              aria-label="Close beat claim form"
              disabled={submitting}
            >
              <X className="h-4 w-4" />
            </button>

            <div className="pr-10">
              <p className="text-xs font-bold uppercase tracking-wider text-primary">You selected</p>
              <h2 id="claim-beat-title" className="mt-2 text-2xl font-black">{selectedBeat.title}</h2>
              <p className="mt-2 text-sm text-white/55">{beatStyle(selectedBeat)} / {formatDuration(selectedBeat.duration_seconds)}</p>
            </div>

            <form onSubmit={handleSubmit} className="mt-6">
              <h3 className="text-lg font-black uppercase">Where should I send the beat?</h3>
              <p className="mt-1 text-sm text-white/55">Enter your email and I will send your private beat page.</p>
              <label className="relative mt-4 block">
                <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45" />
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="h-12 border-white/15 bg-white/[0.04] pl-11 text-white placeholder:text-white/35"
                  autoFocus
                />
              </label>
              <Button type="submit" variant="hero" size="lg" className="mt-3 w-full" disabled={submitting}>
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Send Me This Beat
              </Button>
              <p className="mt-3 flex items-center gap-2 text-xs text-white/45">
                <Lock className="h-3.5 w-3.5" /> We will email your beat page and offer link.
              </p>
            </form>
          </div>
        </div>
      ) : null}

      <audio ref={audioRef} preload="metadata" />
    </div>
  );
}

function MiniWave({ active }: { active: boolean }) {
  return (
    <div className="hidden h-9 items-center gap-1 md:flex" aria-hidden="true">
      {Array.from({ length: 32 }).map((_, i) => (
        <span
          key={i}
          className={(active ? "bg-primary" : "bg-white/25") + " w-px rounded-full transition-colors"}
          style={{ height: 7 + Math.abs(Math.sin(i * 0.85)) * 24 }}
        />
      ))}
    </div>
  );
}