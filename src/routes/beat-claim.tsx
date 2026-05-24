import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Loader2, Lock, Mail, Pause, Play, Waves, X } from "lucide-react";
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
      {
        name: "description",
        content: "Preview a beat, swipe through the catalog, and get your private beat page by email.",
      },
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
    <div className="flex h-9 flex-1 items-end gap-1 overflow-hidden rounded-md bg-black/30 px-3 py-2">
      {Array.from({ length: 28 }).map((_, index) => (
        <span
          key={index}
          className={`w-full rounded-full ${active ? "bg-primary" : "bg-white/35"}`}
          style={{
            height: `${28 + ((index * 19) % 58)}%`,
            opacity: active ? 0.58 + (index % 5) * 0.08 : 0.35,
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

  const selectedIndex = Math.max(
    0,
    beats.findIndex((beat) => beat.id === selectedId),
  );
  const selectedBeat = beats.find((beat) => beat.id === selectedId) ?? preselectedBeat ?? beats[0] ?? null;
  const playingBeat = beats.find((beat) => beat.id === playingId) ?? selectedBeat;
  const isSelectedPlaying = Boolean(selectedBeat && playingId === selectedBeat.id && isPlaying);

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

  function selectByOffset(offset: number) {
    if (!beats.length) return;
    const current = selectedBeat ? beats.findIndex((beat) => beat.id === selectedBeat.id) : 0;
    const nextIndex = (Math.max(0, current) + offset + beats.length) % beats.length;
    const nextBeat = beats[nextIndex];
    setSelectedId(nextBeat.id);
    if (isPlaying) void playBeat(nextBeat);
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
    <div className="min-h-screen bg-[#06080c] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(212,175,55,0.16),transparent_34%),linear-gradient(180deg,rgba(6,8,12,0.15),#06080c_70%)]" />
      <div className="relative min-h-screen">
        <header className="border-b border-white/10">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
            <Link to="/" aria-label="MYBEATCATALOG home">
              <KrazyLogo className="text-2xl" />
            </Link>
            <div className="hidden items-center gap-3 text-sm font-semibold uppercase tracking-wide text-white md:flex">
              <Waves className="h-5 w-5 text-primary" />
              High Quality Beats
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-6 pb-12 sm:px-5">
          <section className="mx-auto max-w-3xl text-center">
            <Badge className="mb-3 bg-primary/20 text-primary hover:bg-primary/20">Coming from Instagram?</Badge>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl md:text-5xl">
              CLAIM A BEAT FOR YOUR NEXT SONG
            </h1>
            <p className="mt-3 text-sm leading-6 text-white/70 sm:text-base">
              Pick one beat, preview it, and get a private beat page sent straight to your email.
            </p>
            <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-white/45">
              No spam. Just the beat page, usage details, and next steps if you want to license it.
            </p>
          </section>

          <section className="mt-7 grid gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(330px,0.65fr)]">
            <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3 shadow-2xl shadow-black/35">
              <div className="mx-auto w-full max-w-[430px] overflow-hidden rounded-xl border border-white/10 bg-black">
                <div className="relative aspect-[9/16] min-h-[460px] overflow-hidden">
                  {selectedBeat?.cover_url ? (
                    <img
                      src={selectedBeat.cover_url}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover opacity-85"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-[linear-gradient(135deg,#10151f,#27210d_52%,#050608)]" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/15 to-black/75" />
                  <div className="absolute left-4 right-4 top-4 flex items-center justify-between">
                    <Badge className="bg-black/60 text-white hover:bg-black/60">Featured preview</Badge>
                    <span className="rounded-full bg-black/60 px-3 py-1 text-xs font-bold text-white/85">
                      {selectedIndex + 1}/{Math.max(beats.length, 1)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => selectedBeat && playBeat(selectedBeat)}
                    className="absolute left-1/2 top-1/2 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/35 bg-white/15 text-white shadow-2xl backdrop-blur transition hover:scale-105 hover:bg-white/20"
                    aria-label={isSelectedPlaying ? "Pause beat" : "Play beat"}
                  >
                    {isSelectedPlaying ? <Pause className="h-9 w-9" /> : <Play className="ml-1 h-9 w-9 fill-current" />}
                  </button>
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <div className="rounded-lg border border-white/10 bg-black/65 p-4 backdrop-blur">
                      <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">Now playing</p>
                      <h2 className="mt-1 text-2xl font-black">{selectedBeat?.title ?? "Loading beats..."}</h2>
                      <p className="mt-1 text-sm text-white/65">
                        {selectedBeat ? beatStyle(selectedBeat) : "Loading"}{" "}
                        {selectedBeat?.bpm ? `- ${selectedBeat.bpm} BPM` : ""}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mx-auto mt-3 flex w-full max-w-[430px] items-center gap-2 rounded-xl border border-white/10 bg-black/40 p-2">
                <button
                  type="button"
                  onClick={() => selectByOffset(-1)}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white transition hover:bg-white/10"
                  aria-label="Previous beat"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => selectedBeat && playBeat(selectedBeat)}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition hover:brightness-110"
                  aria-label={isSelectedPlaying ? "Pause beat" : "Play beat"}
                >
                  {isSelectedPlaying ? <Pause className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5 fill-current" />}
                </button>
                <WaveBars active={isSelectedPlaying} />
                <button
                  type="button"
                  onClick={() => selectByOffset(1)}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white transition hover:bg-white/10"
                  aria-label="Next beat"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </div>

            <aside className="rounded-xl border border-primary/25 bg-[#11100b] p-5 shadow-2xl shadow-black/25">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">Get the private page</p>
              <h2 className="mt-2 text-3xl font-black leading-tight">
                GET "{selectedBeat?.title ?? "THIS BEAT"}" FREE
              </h2>
              <p className="mt-3 text-sm leading-6 text-white/70">
                Enter your email and I will send the private beat page with playback, download access, and license
                details.
              </p>
              <form onSubmit={handleSubmit} className="mt-5 space-y-3">
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                  <Input
                    type="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="artist@email.com"
                    className="h-12 border-white/10 bg-black/45 pl-10 text-white placeholder:text-white/35"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={submitting || !selectedBeat}
                  className="h-12 w-full text-base font-black"
                >
                  {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Send My Private Beat Page
                </Button>
              </form>
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-white/10 bg-black/25 p-3 text-xs leading-5 text-white/60">
                <Lock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                No spam. Just this beat page and occasional new beat drops from KRAZYJAYDOTCOM.
              </div>
              <div className="mt-5 grid grid-cols-3 gap-2 text-center text-xs font-bold uppercase tracking-wide text-white/65">
                <div className="rounded-lg bg-black/30 p-3">{formatDuration(selectedBeat?.duration_seconds)}</div>
                <div className="rounded-lg bg-black/30 p-3">
                  {selectedBeat?.bpm ? `${selectedBeat.bpm} BPM` : "BPM"}
                </div>
                <div className="rounded-lg bg-black/30 p-3">{selectedBeat?.music_key ?? "Key"}</div>
              </div>
            </aside>
          </section>

          <section className="mt-8">
            <div className="mb-3 flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">Browse more beats</p>
                <h2 className="mt-1 text-2xl font-black">Swipe with the player or choose from the catalog.</h2>
              </div>
              <span className="hidden text-sm text-white/45 sm:block">{beats.length} beats available</span>
            </div>

            <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.025] shadow-2xl shadow-black/30">
              <div className="hidden grid-cols-[44px_1fr_148px_96px_170px_104px] gap-3 border-b border-white/10 px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-white/55 md:grid">
                <span>#</span>
                <span>Track</span>
                <span>Mood / Style</span>
                <span>Duration</span>
                <span>Play</span>
                <span>Claim</span>
              </div>

              {beatsQuery.isLoading ? (
                <div className="flex min-h-[260px] items-center justify-center text-white/70">
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Loading beats...
                </div>
              ) : beats.length ? (
                <div className="divide-y divide-white/10">
                  {beats.map((beat, index) => {
                    const active = selectedBeat?.id === beat.id;
                    const playing = playingId === beat.id && isPlaying;
                    return (
                      <div
                        key={beat.id}
                        className={`grid gap-3 px-4 py-4 transition md:grid-cols-[44px_1fr_148px_96px_170px_104px] md:items-center md:px-5 ${
                          active ? "bg-primary/10" : "hover:bg-white/[0.035]"
                        }`}
                      >
                        <div className="hidden text-sm font-bold text-white/45 md:block">
                          {String(index + 1).padStart(2, "0")}
                        </div>
                        <button type="button" onClick={() => setSelectedId(beat.id)} className="min-w-0 text-left">
                          <div className="flex items-center gap-3">
                            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-white/10">
                              {beat.cover_url ? (
                                <img src={beat.cover_url} alt="" className="h-full w-full object-cover" />
                              ) : null}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-bold">{beat.title}</p>
                              <p className="truncate text-xs text-white/45">{beat.producer_name ?? "KRAZYJAYDOTCOM"}</p>
                            </div>
                          </div>
                        </button>
                        <div className="text-sm text-white/65">{beatStyle(beat)}</div>
                        <div className="text-sm text-white/55">{formatDuration(beat.duration_seconds)}</div>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => playBeat(beat)}
                          disabled={!beatAudio(beat)}
                          className="w-full justify-center md:w-auto"
                        >
                          {playing ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
                          {playing ? "Pause" : "Preview"}
                        </Button>
                        <Button type="button" onClick={() => openClaimModal(beat)} className="w-full md:w-auto">
                          Get Page
                        </Button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="px-6 py-12 text-center text-white/65">
                  No claimable beats are live yet. Turn on beat claims in the admin catalog.
                </div>
              )}
            </div>
          </section>
        </main>
      </div>

      <audio ref={audioRef} className="hidden" />

      {claimModalOpen && selectedBeat ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#0b0d12] p-5 text-white shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">You selected</p>
                <h2 className="mt-1 text-2xl font-black">{selectedBeat.title}</h2>
                <p className="mt-1 text-sm text-white/55">{beatStyle(selectedBeat)}</p>
              </div>
              <button
                type="button"
                onClick={() => setClaimModalOpen(false)}
                className="rounded-full border border-white/10 p-2 text-white/60 transition hover:bg-white/10 hover:text-white"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 rounded-lg border border-white/10 bg-white/[0.03] p-4">
              <h3 className="text-lg font-black">SEND YOUR PRIVATE BEAT PAGE</h3>
              <p className="mt-2 text-sm leading-6 text-white/65">
                I will send playback, stream/download access, and the next steps if you want to license this beat.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-5 space-y-3">
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="artist@email.com"
                  className="h-12 border-white/10 bg-black/40 pl-10 text-white placeholder:text-white/35"
                />
              </div>
              <Button type="submit" disabled={submitting} className="h-12 w-full font-black">
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Send My Private Beat Page
              </Button>
              <div className="flex items-center justify-center gap-2 text-xs text-white/45">
                <Lock className="h-3.5 w-3.5" />
                No spam. Just this beat page and occasional new beat drops.
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
