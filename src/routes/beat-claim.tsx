import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownToLine, Loader2, Lock, Mail, Pause, Play, Search, SkipBack, SkipForward, Waves } from "lucide-react";
import { toast } from "sonner";
import { KrazyLogo } from "@/components/krazy-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { claimBeatAndSendFox } from "@/lib/beat-claims.functions";

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
  const claimBeat = useServerFn(claimBeatAndSendFox);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [selectedId, setSelectedId] = useState("");
  const [playingId, setPlayingId] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [email, setEmail] = useState("");
  const [filter, setFilter] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);

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

  const selectedBeat = beats.find((beat) => beat.id === selectedId) ?? preselectedBeat ?? beats[0] ?? null;
  const playingBeat = beats.find((beat) => beat.id === playingId) ?? selectedBeat;
  const visibleBeats = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return beats;
    return beats.filter((beat) => [beat.title, beat.genre, beat.mood, String(beat.bpm ?? "")].join(" ").toLowerCase().includes(q));
  }, [beats, filter]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => {
      setCurrentTime(audio.currentTime || 0);
      const duration = audio.duration || playingBeat?.duration_seconds || 0;
      setAudioDuration(duration);
      setProgress(duration ? (audio.currentTime / duration) * 100 : 0);
    };
    const onEnded = () => setIsPlaying(false);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onTime);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onTime);
      audio.removeEventListener("ended", onEnded);
    };
  }, [playingBeat?.duration_seconds, playingId]);

  useEffect(() => {
    if (!playingBeat) return;
    const audio = audioRef.current;
    if (!audio) return;
    const src = beatAudio(playingBeat);
    if (!src) return;
    audio.src = src;
    audio.load();
    setProgress(0);
    setCurrentTime(0);
    setAudioDuration(playingBeat.duration_seconds ?? 0);
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

  function step(direction: 1 | -1) {
    if (!beats.length || !playingBeat) return;
    const index = beats.findIndex((beat) => beat.id === playingBeat.id);
    const next = beats[(index + direction + beats.length) % beats.length];
    if (next) void playBeat(next);
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
      const result = await claimBeat({
        data: {
          email: cleanEmail,
          beatId: selectedBeat.id,
          source: search.source ?? "beat-claim",
          origin: window.location.origin,
        },
      });
      if (!result.ok || !result.token) throw new Error(result.error ?? "Unable to reserve this beat.");
      if (result.sendfox.configured && !result.sendfox.ok) {
        toast.message("Beat reserved. SendFox needs attention, but your lead was saved.");
      }
      navigate({ to: "/offer/$token", params: { token: result.token } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to reserve this beat.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#03070b] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(37,99,235,0.22),transparent_38%),linear-gradient(180deg,rgba(3,7,11,0.25),#03070b_75%)]" />
      <div className="relative min-h-screen pb-[300px]">
        <header className="border-b border-white/10">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5">
            <Link to="/" aria-label="MYBEATCATALOG home">
              <KrazyLogo className="text-2xl" />
            </Link>
            <div className="hidden items-center gap-3 text-sm font-semibold uppercase tracking-wide text-white md:flex">
              <Waves className="h-5 w-5 text-primary" />
              High Quality Beats
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-5 py-10">
          <section className="text-center">
            <h1 className="text-4xl font-black tracking-tight md:text-6xl">
              PICK YOUR <span className="text-primary">BEAT</span>
            </h1>
            <p className="mt-4 text-base text-white/60 md:text-lg">
              Preview the tracks below and claim the one that fits your sound.
            </p>
          </section>

          <div className="mx-auto mt-8 max-w-xl">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
              <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search beats" className="h-12 border-white/10 bg-white/5 pl-11 text-white placeholder:text-white/35" />
            </label>
          </div>

          <section className="mt-10 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] shadow-2xl shadow-black/30">
            <div className="hidden grid-cols-[56px_1fr_180px_120px_210px_140px] gap-4 border-b border-white/10 px-6 py-4 text-xs font-bold uppercase tracking-wider text-white/55 md:grid">
              <span>#</span>
              <span>Track</span>
              <span>Mood / Style</span>
              <span>Duration</span>
              <span>Wave</span>
              <span className="text-center">Play</span>
            </div>

            {beatsQuery.isLoading ? (
              <div className="flex items-center justify-center gap-2 px-6 py-16 text-white/60">
                <Loader2 className="h-5 w-5 animate-spin" /> Loading beats...
              </div>
            ) : visibleBeats.length === 0 ? (
              <div className="px-6 py-16 text-center text-white/55">No beats found.</div>
            ) : (
              visibleBeats.map((beat, index) => {
                const active = selectedBeat?.id === beat.id;
                const playing = playingBeat?.id === beat.id && isPlaying;
                return (
                  <div
                    key={beat.id}
                    className={"grid gap-4 border-b border-white/10 px-4 py-4 transition last:border-b-0 md:grid-cols-[56px_1fr_180px_120px_210px_140px] md:items-center md:px-6 " + (active ? "bg-primary/10 ring-1 ring-inset ring-primary/40" : "hover:bg-white/[0.04]")}
                  >
                    <div className="flex items-center gap-4 md:contents">
                      <div className="font-mono text-lg font-bold text-primary">{String(index + 1).padStart(2, "0")}</div>
                      <button type="button" onClick={() => playBeat(beat)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/25 text-white transition hover:border-primary hover:text-primary md:hidden">
                        {playing ? <Pause className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5" />}
                      </button>
                    </div>

                    <div className="flex min-w-0 items-center gap-4">
                      <button type="button" onClick={() => playBeat(beat)} className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/25 text-white transition hover:border-primary hover:text-primary md:flex">
                        {playing ? <Pause className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5" />}
                      </button>
                      <div className="min-w-0">
                        <p className="truncate text-lg font-bold">{beat.title}</p>
                        <p className="mt-1 text-xs text-white/45 md:hidden">{beatStyle(beat)} · {formatDuration(beat.duration_seconds)}</p>
                      </div>
                    </div>

                    <div className="hidden md:block"><Badge variant="outline" className="border-primary/50 bg-primary/10 text-primary">{beatStyle(beat)}</Badge></div>
                    <div className="hidden font-mono text-white/70 md:block">{formatDuration(beat.duration_seconds)}</div>
                    <MiniWave active={active || playing} />
                    <Button type="button" variant={active ? "hero" : "outline"} className="h-12 border-primary/60" onClick={() => setSelectedId(beat.id)}>
                      {active ? "Selected" : "Select"}
                    </Button>
                  </div>
                );
              })
            )}
          </section>

          <div className="mt-8 flex items-center justify-center gap-2 text-sm text-white/55">
            <Lock className="h-4 w-4" /> Your email is safe with us. No spam.
          </div>
        </main>

        <section className="fixed inset-x-0 bottom-0 z-20 border-t border-primary/60 bg-[#03070b]/95 shadow-[0_-20px_80px_rgba(37,99,235,0.18)] backdrop-blur-xl">
          <div className="mx-auto grid max-w-7xl gap-6 px-5 py-5 lg:grid-cols-[1fr_420px] lg:items-center">
            <div className="grid gap-4 md:grid-cols-[128px_1fr_220px] md:items-center">
              <div className="hidden aspect-square items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] md:flex">
                {playingBeat?.cover_url ? <img src={playingBeat.cover_url} alt={playingBeat.title} className="h-full w-full rounded-xl object-cover" /> : <Waves className="h-16 w-16 text-primary" />}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wider text-primary">Now Playing</p>
                <h2 className="mt-2 truncate text-2xl font-black">{playingBeat?.title ?? "Choose a beat"}</h2>
                {playingBeat ? <p className="mt-2 text-sm text-white/50">{beatStyle(playingBeat)} · {formatDuration(playingBeat.duration_seconds)}</p> : null}
                <div className="mt-4 flex items-center gap-3">
                  <span className="w-11 text-xs font-mono text-white/50">{formatDuration(Math.floor(currentTime))}</span>
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/15"><div className="h-full bg-primary" style={{ width: progress + "%" }} /></div>
                  <span className="w-11 text-right text-xs font-mono text-white/50">{formatDuration(Math.floor(audioDuration || playingBeat?.duration_seconds || 0))}</span>
                </div>
              </div>
              <div className="flex items-center justify-center gap-5">
                <button type="button" onClick={() => step(-1)} className="text-white transition hover:text-primary"><SkipBack className="h-7 w-7" /></button>
                <button type="button" onClick={() => playingBeat && playBeat(playingBeat)} className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_0_40px_rgba(37,99,235,0.45)]">
                  {isPlaying ? <Pause className="h-8 w-8" /> : <Play className="ml-1 h-8 w-8" />}
                </button>
                <button type="button" onClick={() => step(1)} className="text-white transition hover:text-primary"><SkipForward className="h-7 w-7" /></button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="border-white/10 lg:border-l lg:pl-7">
              <h3 className="text-xl font-black uppercase">Like this beat?</h3>
              <p className="mt-1 text-sm text-white/55">Enter your email to claim it now.</p>
              <label className="relative mt-4 block">
                <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45" />
                <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" className="h-12 border-white/15 bg-white/[0.04] pl-11 text-white placeholder:text-white/35" />
              </label>
              <Button type="submit" variant="hero" size="lg" className="mt-3 w-full" disabled={submitting || !selectedBeat}>
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Claim This Beat
                <ArrowDownToLine className="ml-2 h-4 w-4" />
              </Button>
              <p className="mt-3 flex items-center gap-2 text-xs text-white/45"><Lock className="h-3.5 w-3.5" /> We will email your private beat page and offer link.</p>
            </form>
          </div>
        </section>
      </div>
      <audio ref={audioRef} preload="metadata" />
    </div>
  );
}

function MiniWave({ active }: { active: boolean }) {
  return (
    <div className="hidden h-10 items-center gap-1 md:flex" aria-hidden="true">
      {Array.from({ length: 34 }).map((_, i) => (
        <span
          key={i}
          className={(active ? "bg-primary" : "bg-white/25") + " w-px rounded-full transition-colors"}
          style={{ height: 8 + Math.abs(Math.sin(i * 0.85)) * 26 }}
        />
      ))}
    </div>
  );
}
