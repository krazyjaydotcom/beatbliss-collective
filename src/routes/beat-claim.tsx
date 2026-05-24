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
      { name: "description", content: "Preview a beat, search by name, and get your private beat page by email." },
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
    <div className="flex h-8 flex-1 items-end gap-1 overflow-hidden rounded-md bg-black px-3 py-2">
      {Array.from({ length: 24 }).map((_, index) => (
        <span
          key={index}
          className={active ? "w-full rounded-full bg-primary" : "w-full rounded-full bg-white/35"}
          style={{ height: `${24 + ((index * 23) % 62)}%`, opacity: active ? 0.6 + (index % 4) * 0.09 : 0.34 }}
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
  const selectedIndex = selectedBeat ? beats.findIndex((beat) => beat.id === selectedBeat.id) : 0;
  const isSelectedPlaying = Boolean(selectedBeat && playingId === selectedBeat.id && isPlaying);
  const filteredBeats = useMemo(() => {
    const term = beatSearch.trim().toLowerCase();
    if (!term) return beats.slice(0, 5);
    return beats
      .filter((beat) => [beat.title, beat.genre, beat.mood].filter(Boolean).join(" ").toLowerCase().includes(term))
      .slice(0, 5);
  }, [beats, beatSearch]);

  useEffect(() => {
    if (!selectedId && preselectedBeat) setSelectedId(preselectedBeat.id);
    if (!selectedId && !preselectedBeat && beats[0]) setSelectedId(beats[0].id);
  }, [beats, preselectedBeat, selectedId]);

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

  function selectBeat(beat: ClaimableBeat) {
    setSelectedId(beat.id);
    setBeatSearch(beat.title);
  }

  function selectByOffset(offset: number) {
    if (!beats.length) return;
    const current = selectedBeat ? beats.findIndex((beat) => beat.id === selectedBeat.id) : 0;
    const nextBeat = beats[(Math.max(0, current) + offset + beats.length) % beats.length];
    setSelectedId(nextBeat.id);
    setBeatSearch(nextBeat.title);
    if (isPlaying) void playBeat(nextBeat);
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
    <div className="min-h-screen bg-[#e8e1d0] text-[#121212]">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center px-4 py-6">
        <div className="w-full max-w-[390px] rounded-[2.35rem] border-[10px] border-black bg-black p-2 shadow-2xl shadow-black/40">
          <div className="overflow-hidden rounded-[1.65rem] bg-[#f4eddf]">
            <header className="flex items-center justify-between border-b border-black/10 bg-white px-4 py-3">
              <Link to="/" aria-label="MYBEATCATALOG home" className="scale-90 origin-left">
                <KrazyLogo className="text-lg text-black" />
              </Link>
              <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wide text-black/55">
                <Waves className="h-3.5 w-3.5 text-primary" />
                Beats
              </div>
            </header>

            <section className="bg-black p-2">
              <div className="relative aspect-video overflow-hidden rounded-md bg-black">
                {selectedBeat?.cover_url ? (
                  <img src={selectedBeat.cover_url} alt="" className="h-full w-full object-cover opacity-80" />
                ) : (
                  <div className="h-full w-full bg-[linear-gradient(135deg,#1c1c1c,#3a2b11_55%,#080808)]" />
                )}
                <div className="absolute inset-0 bg-black/35" />
                <div className="absolute left-2 top-2 rounded bg-black/75 px-2 py-1 text-[10px] font-bold text-white">
                  YouTube Video JJ Ma...
                </div>
                <button
                  type="button"
                  onClick={() => selectedBeat && playBeat(selectedBeat)}
                  className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/70 text-white"
                  aria-label={isSelectedPlaying ? "Pause beat" : "Play beat"}
                >
                  {isSelectedPlaying ? <Pause className="h-7 w-7" /> : <Play className="ml-1 h-7 w-7 fill-current" />}
                </button>
                <div className="absolute bottom-1 left-2 right-2 flex items-center gap-2 text-[10px] font-bold text-white">
                  <span>{isSelectedPlaying ? "II" : "▶"}</span>
                  <div className="h-1 flex-1 rounded-full bg-white/25">
                    <div className="h-full w-2/5 rounded-full bg-primary" />
                  </div>
                  <span>{formatDuration(selectedBeat?.duration_seconds)}</span>
                </div>
              </div>
            </section>

            <section className="px-4 pb-5 pt-3">
              <div className="flex items-center gap-2 rounded bg-black px-2 py-2">
                <button
                  type="button"
                  onClick={() => selectedBeat && playBeat(selectedBeat)}
                  className="text-white"
                  aria-label="Play selected beat"
                >
                  {isSelectedPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current" />}
                </button>
                <WaveBars active={isSelectedPlaying} />
              </div>

              <div className="mt-2 flex items-center rounded-md border border-[#d6c9aa] bg-[#fffaf0] shadow-sm">
                <button
                  type="button"
                  onClick={() => selectByOffset(-1)}
                  className="flex h-10 w-10 items-center justify-center text-[#b49142]"
                  aria-label="Previous beat"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <div className="min-w-0 flex-1 text-center">
                  <p className="truncate text-sm font-bold">{selectedBeat?.title ?? "Loading beats..."}</p>
                  <p className="text-[10px] font-black uppercase tracking-wide text-[#b49142]">Now playing</p>
                </div>
                <button
                  type="button"
                  onClick={() => selectByOffset(1)}
                  className="flex h-10 w-10 items-center justify-center text-[#b49142]"
                  aria-label="Next beat"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>

              <div className="relative mt-3">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/35" />
                <Input
                  value={beatSearch}
                  onChange={(event) => setBeatSearch(event.target.value)}
                  placeholder="Search beat name"
                  className="h-10 border-[#d6c9aa] bg-white pl-9 text-sm text-black placeholder:text-black/35"
                />
              </div>
              {beatSearch.trim() ? (
                <div className="mt-2 overflow-hidden rounded-md border border-[#d6c9aa] bg-white">
                  {filteredBeats.length ? (
                    filteredBeats.map((beat) => (
                      <button
                        key={beat.id}
                        type="button"
                        onClick={() => selectBeat(beat)}
                        className="flex w-full items-center justify-between gap-3 border-b border-black/5 px-3 py-2 text-left last:border-0"
                      >
                        <span className="truncate text-sm font-bold">{beat.title}</span>
                        <span className="shrink-0 text-[10px] font-bold uppercase text-black/45">
                          {beat.bpm ? `${beat.bpm} BPM` : beatStyle(beat)}
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-xs text-black/55">No beat found by that name.</div>
                  )}
                </div>
              ) : null}

              <form onSubmit={handleSubmit} className="mt-4">
                <p className="text-center text-[11px] font-black uppercase tracking-wide text-black/35">
                  Get the selected beat free
                </p>
                <h1 className="mx-auto mt-1 max-w-[270px] text-center text-2xl font-black leading-7">
                  GET "{selectedBeat?.title ?? "THIS BEAT"}" FREE:
                </h1>
                <div className="relative mt-3">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/55" />
                  <Input
                    type="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="Enter your email"
                    className="h-11 border-black bg-[#202020] pl-10 text-white placeholder:text-white/45"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={submitting || !selectedBeat}
                  className="mt-2 h-11 w-full bg-[#c7a24b] text-sm font-black text-black hover:bg-[#d6b45b]"
                >
                  {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  GET MY FREE BEAT
                </Button>
                <div className="mt-2 flex items-center justify-center gap-1 text-[10px] font-medium text-black/45">
                  <Lock className="h-3 w-3" />
                  We respect your privacy. No spam.
                </div>
              </form>
            </section>
          </div>
        </div>
      </div>
      <audio ref={audioRef} className="hidden" />
    </div>
  );
}
