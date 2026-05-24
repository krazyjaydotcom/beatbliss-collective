import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Loader2, Lock, Mail, Pause, Play, Search, Waves } from "lucide-react";
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
      { title: "Claim A Beat - MYBEATCATALOG" },
      { name: "description", content: "Search, preview, and claim a private beat page by email." },
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
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
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

function getDeviceFingerprint() {
  if (typeof window === "undefined") return "";
  const key = "mbc_beat_claim_device";
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const generated = window.crypto?.randomUUID?.() || Math.random().toString(36).slice(2) + Date.now().toString(36);
  window.localStorage.setItem(key, generated);
  return generated;
}

function WaveBars({ active }: { active: boolean }) {
  return (
    <div className="flex h-12 flex-1 items-end gap-1 overflow-hidden rounded-lg bg-black/35 px-3 py-2">
      {Array.from({ length: 30 }).map((_, index) => (
        <span
          key={index}
          className={`w-full rounded-full bg-sky-400 ${active ? "animate-pulse" : ""}`}
          style={{
            height: `${22 + ((index * 29) % 68)}%`,
            opacity: active ? 0.7 + (index % 4) * 0.075 : 0.28,
            animationDelay: `${index * 55}ms`,
            animationDuration: `${650 + ((index * 37) % 520)}ms`,
          }}
        />
      ))}
    </div>
  );
}

function BeatClaimPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [selectedId, setSelectedId] = useState("");
  const [playingId, setPlayingId] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [email, setEmail] = useState("");
  const [beatSearch, setBeatSearch] = useState("");
  const [selectedPulseKey, setSelectedPulseKey] = useState(0);
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

  const selectedBeat = beats.find((beat) => beat.id === selectedId) ?? preselectedBeat ?? beats[0] ?? null;
  const playingBeat = beats.find((beat) => beat.id === playingId) ?? selectedBeat;
  const isSelectedPlaying = Boolean(selectedBeat && playingId === selectedBeat.id && isPlaying);
  const filteredBeats = useMemo(() => {
    const term = beatSearch.trim().toLowerCase();
    if (!term) return [];
    return beats
      .filter((beat) => [beat.title, beat.genre, beat.mood].filter(Boolean).join(" ").toLowerCase().includes(term))
      .slice(0, 5);
  }, [beats, beatSearch]);

  useEffect(() => {
    if (!selectedId && preselectedBeat) setSelectedId(preselectedBeat.id);
    if (!selectedId && !preselectedBeat && beats[0]) setSelectedId(beats[0].id);
  }, [beats, preselectedBeat, selectedId]);

  useEffect(() => {
    setSelectedPulseKey((key) => key + 1);
  }, [selectedBeat?.id]);

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

  function chooseBeat(beat: ClaimableBeat) {
    setSelectedId(beat.id);
    setBeatSearch(beat.title);
  }

  function selectByOffset(offset: number) {
    if (!beats.length) return;
    const current = selectedBeat ? beats.findIndex((beat) => beat.id === selectedBeat.id) : 0;
    const nextBeat = beats[(Math.max(0, current) + offset + beats.length) % beats.length];
    chooseBeat(nextBeat);
    if (isPlaying) void playBeat(nextBeat);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedBeat) {
      toast.error("Search or choose the beat you want first.");
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
          deviceFingerprint: getDeviceFingerprint(),
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
    <div className="min-h-screen bg-[#f3efe6] text-[#101114]">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 pb-40 pt-4 sm:px-6 lg:pb-44">
        <header className="flex items-center justify-between py-2">
          <Link to="/" aria-label="MYBEATCATALOG home">
            <KrazyLogo className="text-xl text-black" />
          </Link>
          <Badge className="bg-sky-100 text-sky-700 hover:bg-sky-100">Beat claim</Badge>
        </header>

        <main className="grid flex-1 gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
          <section className="overflow-hidden rounded-xl border border-black/10 bg-black shadow-2xl shadow-black/20">
            <div className="relative aspect-video min-h-[220px] sm:min-h-[320px]">
              {selectedBeat?.cover_url ? (
                <img
                  src={selectedBeat.cover_url}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover opacity-70"
                />
              ) : (
                <div className="absolute inset-0 bg-[linear-gradient(135deg,#111827,#2a2110_55%,#050505)]" />
              )}
              <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/35 to-black/80" />
              <div className="absolute left-4 top-4 rounded bg-black/70 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white/80">
                Beat preview
              </div>
              <button
                type="button"
                onClick={() => selectedBeat && playBeat(selectedBeat)}
                className="absolute left-1/2 top-1/2 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition hover:scale-105 hover:bg-white/25"
                aria-label={isSelectedPlaying ? "Pause beat" : "Play beat"}
              >
                {isSelectedPlaying ? <Pause className="h-9 w-9" /> : <Play className="ml-1 h-9 w-9 fill-current" />}
              </button>
              <div className="absolute bottom-4 left-4 right-4">
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-sky-300">Now playing</p>
                <div className="mt-1 overflow-hidden">
                  <p className="whitespace-nowrap text-3xl font-black text-white">
                    {selectedBeat?.title ?? "Loading beats..."}
                  </p>
                </div>
                <p className="mt-1 text-sm text-white/65">
                  {selectedBeat ? beatStyle(selectedBeat) : "Loading"}{" "}
                  {selectedBeat?.bpm ? `- ${selectedBeat.bpm} BPM` : ""}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-black/10 bg-white p-5 shadow-xl shadow-black/10 lg:sticky lg:top-5">
            <p className="text-center text-xs font-black uppercase tracking-[0.2em] text-sky-600">
              Get the selected beat free
            </p>
            <h1
              key={selectedPulseKey}
              className="mx-auto mt-2 max-w-[320px] animate-in fade-in duration-700 text-center text-3xl font-black leading-tight"
            >
              GET "{selectedBeat?.title ?? "THIS BEAT"}" FREE
            </h1>
            <p className="mt-3 text-center text-sm leading-6 text-black/60">
              Enter your email and I will send the private beat page with playback, download access, and next steps.
            </p>
            <form onSubmit={handleSubmit} className="mt-5 space-y-3">
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/35" />
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Enter your email"
                  className="h-12 border-black/10 bg-[#f7f7f7] pl-10 text-black placeholder:text-black/35"
                />
              </div>
              <Button
                type="submit"
                disabled={submitting || !selectedBeat}
                className="h-12 w-full bg-sky-600 text-base font-black text-white hover:bg-sky-700"
              >
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                GET MY FREE BEAT
              </Button>
              <div className="flex items-center justify-center gap-1 text-xs font-medium text-black/45">
                <Lock className="h-3.5 w-3.5" />
                We respect your privacy. No spam.
              </div>
            </form>
          </section>
        </main>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-black/10 bg-white/95 shadow-2xl shadow-black/25 backdrop-blur">
        <div className="mx-auto grid max-w-5xl gap-3 px-4 py-3 sm:px-6 lg:grid-cols-[1fr_1.15fr] lg:items-center">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => selectByOffset(-1)}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-black/10 bg-white"
              aria-label="Previous beat"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => selectedBeat && playBeat(selectedBeat)}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-sky-600 text-white"
              aria-label={isSelectedPlaying ? "Pause beat" : "Play beat"}
            >
              {isSelectedPlaying ? <Pause className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5 fill-current" />}
            </button>
            <WaveBars active={isSelectedPlaying} />
            <button
              type="button"
              onClick={() => selectByOffset(1)}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-black/10 bg-white"
              aria-label="Next beat"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          <div className="min-w-0">
            <div className="mb-2 overflow-hidden rounded-md bg-black px-3 py-1.5 text-white">
              <p className="animate-[marquee_12s_linear_infinite] whitespace-nowrap text-sm font-black">
                {selectedBeat?.title ?? "Search or swipe to choose a beat"} -{" "}
                {selectedBeat ? beatStyle(selectedBeat) : "Beat preview"} -{" "}
                {formatDuration(selectedBeat?.duration_seconds)}
              </p>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/35" />
              <Input
                value={beatSearch}
                onChange={(event) => setBeatSearch(event.target.value)}
                placeholder="Search beat name"
                className="h-11 border-black/10 bg-white pl-9 text-black placeholder:text-black/35"
                aria-label="Search beat name"
              />
              {beatSearch.trim() && filteredBeats.length ? (
                <div className="absolute bottom-full left-0 right-0 mb-2 overflow-hidden rounded-lg border border-black/10 bg-white shadow-xl">
                  {filteredBeats.map((beat) => (
                    <button
                      key={beat.id}
                      type="button"
                      onClick={() => chooseBeat(beat)}
                      className="flex w-full items-center justify-between gap-3 border-b border-black/5 px-3 py-2 text-left last:border-0 hover:bg-sky-50"
                    >
                      <span className="truncate text-sm font-bold">{beat.title}</span>
                      <span className="shrink-0 text-[10px] font-bold uppercase text-black/45">
                        {beat.bpm ? `${beat.bpm} BPM` : beatStyle(beat)}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <audio ref={audioRef} className="hidden" />
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
      `}</style>
    </div>
  );
}
