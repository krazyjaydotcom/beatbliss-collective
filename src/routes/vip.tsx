import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle2,
  Headphones,
  ListMusic,
  Pause,
  Play,
  Search,
  ShieldCheck,
  SkipBack,
  SkipForward,
  Sparkles,
  Square,
  Volume2,
} from "lucide-react";
import { KrazyLogo } from "@/components/krazy-logo";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/vip")({
  head: () => ({
    meta: [
      { title: "Beats For Purpose-Driven Artists — MYBEATCATALOG VIP Offer" },
      {
        name: "description",
        content:
          "A private offer for purpose-driven artists: full catalog access, demo licenses, and the beats you need to write the song that actually means something. Limited 30-minute window.",
      },
      { name: "robots", content: "noindex,follow" },
    ],
  }),
  component: VipOfferPage,
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

const TIMER_KEY = "mbc_vip_offer_started_at";
const TIMER_DURATION_MS = 30 * 60 * 1000;
const REDIRECT_URL = "https://mybeatcatalog.com";

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

function WaveBars({ active }: { active: boolean }) {
  return (
    <div className="flex h-7 w-32 items-end gap-0.5 overflow-hidden rounded bg-white/5 px-2 py-1 sm:w-52">
      {Array.from({ length: 24 }).map((_, index) => (
        <span
          key={index}
          className={`w-full rounded-full bg-sky-300 ${active ? "animate-pulse" : ""}`}
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

function CountdownCell({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="rounded-xl border border-primary/40 bg-primary/10 px-4 py-3 min-w-[72px] text-center">
        <span className="text-3xl md:text-4xl font-black tabular-nums text-foreground">
          {String(value).padStart(2, "0")}
        </span>
      </div>
      <span className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

function useVipCountdown() {
  const [now, setNow] = useState(() => Date.now());
  const [startedAt, setStartedAt] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(TIMER_KEY);
    let start = stored ? Number(stored) : NaN;
    if (!stored || !Number.isFinite(start)) {
      start = Date.now();
      window.localStorage.setItem(TIMER_KEY, String(start));
    }
    setStartedAt(start);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = startedAt
    ? Math.max(0, startedAt + TIMER_DURATION_MS - now)
    : TIMER_DURATION_MS;

  useEffect(() => {
    if (startedAt && remaining === 0) {
      window.location.replace(REDIRECT_URL);
    }
  }, [startedAt, remaining]);

  const m = Math.floor(remaining / 60000);
  const s = Math.floor((remaining % 60000) / 1000);
  return { minutes: m, seconds: s, expired: startedAt !== null && remaining === 0 };
}

function GumroadEmbed() {
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (document.querySelector('script[data-gumroad-embed="1"]')) return;
    const s = document.createElement("script");
    s.src = "https://gumroad.com/js/gumroad-embed.js";
    s.async = true;
    s.dataset.gumroadEmbed = "1";
    document.body.appendChild(s);
  }, []);

  return (
    <div
      className="gumroad-product-embed"
      dangerouslySetInnerHTML={{
        __html:
          '<a href="https://krazyjaydotcom.gumroad.com/l/MyBeatCatalog">Loading MYBEATCATALOG…</a>',
      }}
    />
  );
}

function VipOfferPage() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [selectedId, setSelectedId] = useState("");
  const [playingId, setPlayingId] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [beatSearch, setBeatSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [volume, setVolume] = useState(1);
  const [selectedPulseKey, setSelectedPulseKey] = useState(0);
  const { minutes, seconds, expired } = useVipCountdown();

  const beatsQuery = useQuery({
    queryKey: ["claimable-beats"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("list_claimable_beats");
      if (error) throw error;
      return (data ?? []) as ClaimableBeat[];
    },
  });

  const beats = beatsQuery.data ?? [];
  const selectedBeat =
    beats.find((beat) => beat.id === selectedId) ?? beats[0] ?? null;
  const playingBeat = beats.find((beat) => beat.id === playingId) ?? selectedBeat;
  const isSelectedPlaying = Boolean(
    selectedBeat && playingId === selectedBeat.id && isPlaying,
  );
  const filteredBeats = useMemo(() => {
    const term = beatSearch.trim().toLowerCase();
    if (!term) return [];
    return beats
      .filter((beat) =>
        [beat.title, beat.genre, beat.mood]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(term),
      )
      .slice(0, 6);
  }, [beats, beatSearch]);

  useEffect(() => {
    if (!selectedId && beats[0]) setSelectedId(beats[0].id);
  }, [beats, selectedId]);

  useEffect(() => {
    setSelectedPulseKey((k) => k + 1);
  }, [selectedBeat?.id]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onEnded = () => setIsPlaying(false);
    audio.addEventListener("ended", onEnded);
    return () => audio.removeEventListener("ended", onEnded);
  }, []);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

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

  function playBeat(beat: ClaimableBeat) {
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
    const current = selectedBeat
      ? beats.findIndex((beat) => beat.id === selectedBeat.id)
      : 0;
    const nextBeat =
      beats[(Math.max(0, current) + offset + beats.length) % beats.length];
    chooseBeat(nextBeat);
    if (isPlaying) void playBeat(nextBeat);
  }

  function stopBeat() {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    setIsPlaying(false);
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 pb-28 pt-4 sm:px-6">
        <header className="flex items-center justify-between py-2">
          <Link to="/" aria-label="MYBEATCATALOG home">
            <KrazyLogo className="text-xl" />
          </Link>
          <span className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-primary">
            Private Offer
          </span>
        </header>

        <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6">
          {/* Countdown */}
          <section className="rounded-xl border border-primary/30 bg-primary/5 p-5">
            <p className="text-center text-xs uppercase tracking-[0.2em] text-muted-foreground">
              {expired
                ? "This offer has closed"
                : "This page closes in"}
            </p>
            <div className="mt-3 flex items-center justify-center gap-3">
              <CountdownCell value={minutes} label="min" />
              <span className="text-3xl font-black text-primary">:</span>
              <CountdownCell value={seconds} label="sec" />
            </div>
            <p className="mt-3 text-center text-[11px] text-muted-foreground">
              When the timer hits zero, you'll be sent back to the public site.
            </p>
          </section>

          {/* Hero / Hormozi-style value stack */}
          <section className="rounded-xl border border-black/10 bg-white p-6 text-black shadow-xl shadow-black/10">
            <p className="text-center text-xs font-black uppercase tracking-[0.25em] text-sky-600">
              For Purpose-Driven Artists
            </p>
            <h1 className="mx-auto mt-2 max-w-2xl text-center text-3xl font-black leading-tight sm:text-4xl">
              Stop chasing beats. Start finishing the songs that actually matter.
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-center text-base leading-7 text-black/70">
              If you make music with a message, you don't need 10,000 throwaway loops —
              you need a small, hand-picked catalog of beats that match your purpose
              so you can write, record, and release on a schedule.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {[
                {
                  icon: Headphones,
                  title: "Full catalog access",
                  body: "Every beat in MYBEATCATALOG, organized by mood and message — not random genre dumps.",
                },
                {
                  icon: ShieldCheck,
                  title: "Demo license included",
                  body: "Write, record, and test songs immediately. Upgrade to a paid license only when you're ready to release.",
                },
                {
                  icon: Sparkles,
                  title: "New beats added weekly",
                  body: "Designed for artists with a message — faith, mental health, struggle, victory, real life.",
                },
                {
                  icon: CheckCircle2,
                  title: "Works in any DAW",
                  body: "Standard MP3 downloads. No plug-ins, no logins, no friction between you and the song.",
                },
              ].map(({ icon: Icon, title, body }) => (
                <div
                  key={title}
                  className="flex items-start gap-3 rounded-lg border border-black/5 bg-[#f7f7f7] p-3"
                >
                  <Icon className="mt-0.5 h-5 w-5 shrink-0 text-sky-600" />
                  <div>
                    <p className="text-sm font-black text-black">{title}</p>
                    <p className="text-xs leading-5 text-black/65">{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Beat preview player headline */}
          <section className="rounded-xl border border-black/10 bg-white p-5 text-black shadow-xl shadow-black/10">
            <p className="text-center text-xs font-black uppercase tracking-[0.2em] text-sky-600">
              Hear what's inside
            </p>
            <h2
              key={selectedPulseKey}
              className="mx-auto mt-2 max-w-full animate-in fade-in duration-700 text-center text-xl font-black leading-tight text-black sm:text-2xl"
              title={selectedBeat?.title ?? "Selected beat"}
            >
              {selectedBeat?.title ?? "Loading beats…"}
            </h2>
            <p className="mt-1 text-center text-sm font-bold text-black/60">
              {selectedBeat ? beatStyle(selectedBeat) : "Tap play below to preview"}
            </p>
            <p className="mx-auto mt-3 max-w-md text-center text-xs leading-5 text-black/55">
              Use the player at the bottom of the screen to skip through the catalog
              and hear what kind of beats you'll unlock.
            </p>
          </section>

          {/* Gumroad embed = the offer */}
          <section className="rounded-xl border-2 border-sky-600 bg-white p-5 text-black shadow-2xl shadow-sky-600/10">
            <p className="text-center text-xs font-black uppercase tracking-[0.25em] text-sky-600">
              Claim Your Access
            </p>
            <h2 className="mt-2 text-center text-2xl font-black sm:text-3xl">
              One time. One price. The whole catalog.
            </h2>
            <p className="mx-auto mt-2 max-w-md text-center text-sm text-black/65">
              Tap below to grab MYBEATCATALOG through our secure checkout. You'll
              get instant access right after purchase.
            </p>

            <div className="mt-5 rounded-lg border border-black/10 bg-[#fafafa] p-4">
              <GumroadEmbed />
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] font-semibold text-black/55">
              <span className="inline-flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5" /> Secure checkout via Gumroad
              </span>
              <span className="inline-flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> Instant access
              </span>
            </div>
          </section>

          {/* FAQ / objection handling */}
          <section className="rounded-xl border border-black/10 bg-white p-5 text-black">
            <h3 className="text-center text-lg font-black">Quick answers</h3>
            <div className="mt-4 space-y-3">
              {[
                {
                  q: "Who is this really for?",
                  a: "Artists who make music with a message and are tired of scrolling YouTube for beats. If you have something to say, this is for you.",
                },
                {
                  q: "Can I release songs commercially?",
                  a: "The demo license lets you write and record. When you're ready to release, upgrade to a paid license — straightforward and affordable.",
                },
                {
                  q: "What happens when the timer hits zero?",
                  a: "This private page closes and you'll be sent back to the public site. Lock in your access while you're here.",
                },
              ].map(({ q, a }) => (
                <div key={q} className="rounded-lg border border-black/5 bg-[#f7f7f7] p-3">
                  <p className="text-sm font-black">{q}</p>
                  <p className="mt-1 text-xs leading-5 text-black/65">{a}</p>
                </div>
              ))}
            </div>
          </section>

          <p className="pb-4 text-center text-[11px] text-muted-foreground">
            © MYBEATCATALOG — Private offer. Not for redistribution.
          </p>
        </main>
      </div>

      {/* Fixed bottom player (same pattern as beat-claim) */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t-4 border-[#a94d4d] bg-black text-white shadow-2xl shadow-black/40">
        <div className="relative mx-auto flex h-16 max-w-6xl items-center gap-1 px-2 sm:px-4">
          {searchOpen ? (
            <div className="absolute bottom-full left-2 right-2 mb-2 rounded-lg border border-white/10 bg-[#111] p-3 shadow-2xl sm:left-auto sm:w-[420px]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                <Input
                  autoFocus
                  value={beatSearch}
                  onChange={(e) => setBeatSearch(e.target.value)}
                  placeholder="Search beat name"
                  className="h-10 border-white/10 bg-black pl-9 text-white placeholder:text-white/40"
                  aria-label="Search beat name"
                />
              </div>
              {beatSearch.trim() ? (
                <div className="mt-2 max-h-48 overflow-auto rounded-md border border-white/10 bg-black">
                  {filteredBeats.length ? (
                    filteredBeats.map((beat) => (
                      <button
                        key={beat.id}
                        type="button"
                        onClick={() => {
                          chooseBeat(beat);
                          setSearchOpen(false);
                        }}
                        className="flex w-full items-center justify-between gap-3 border-b border-white/10 px-3 py-2 text-left last:border-0 hover:bg-white/10"
                      >
                        <span className="truncate text-sm font-bold">{beat.title}</span>
                        <span className="shrink-0 text-[10px] font-bold uppercase text-white/45">
                          {beat.bpm ? `${beat.bpm} BPM` : beatStyle(beat)}
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-sm text-white/55">
                      No beat found by that name.
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => selectByOffset(-1)}
            className="flex h-11 w-10 shrink-0 items-center justify-center text-white hover:bg-white/10"
            aria-label="Previous beat"
          >
            <SkipBack className="h-5 w-5 fill-current" />
          </button>
          <button
            type="button"
            onClick={() => selectedBeat && playBeat(selectedBeat)}
            className="flex h-12 w-12 shrink-0 items-center justify-center text-white hover:bg-white/10"
            aria-label={isSelectedPlaying ? "Pause beat" : "Play beat"}
          >
            {isSelectedPlaying ? (
              <Pause className="h-8 w-8 fill-current" />
            ) : (
              <Play className="h-7 w-7 fill-current" />
            )}
          </button>
          <button
            type="button"
            onClick={stopBeat}
            className="hidden h-10 w-10 shrink-0 items-center justify-center text-white/85 hover:bg-white/10 sm:flex"
            aria-label="Stop beat"
          >
            <Square className="h-4 w-4 fill-current" />
          </button>
          <button
            type="button"
            onClick={() => selectByOffset(1)}
            className="flex h-11 w-10 shrink-0 items-center justify-center text-white hover:bg-white/10"
            aria-label="Next beat"
          >
            <SkipForward className="h-5 w-5 fill-current" />
          </button>

          <div className="min-w-0 flex-1">
            <div className="overflow-hidden">
              <p className="animate-[marquee_13s_linear_infinite] whitespace-nowrap text-sm font-black">
                {selectedBeat?.title ?? "Loading beats"} -{" "}
                {selectedBeat ? beatStyle(selectedBeat) : "Preview"} -{" "}
                {formatDuration(selectedBeat?.duration_seconds)}
              </p>
            </div>
            <div className="mt-1">
              <WaveBars active={isSelectedPlaying} />
            </div>
          </div>

          <div className="ml-auto hidden items-center gap-2 sm:flex">
            <Volume2 className="h-4 w-4 text-white" />
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="h-1 w-20 accent-sky-500"
              aria-label="Volume"
            />
          </div>
          <button
            type="button"
            onClick={() => setSearchOpen((open) => !open)}
            className="flex h-11 w-10 shrink-0 items-center justify-center text-white hover:bg-white/10"
            aria-label="Search beats"
          >
            <Search className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => setSearchOpen((open) => !open)}
            className="flex h-11 w-10 shrink-0 items-center justify-center text-white hover:bg-white/10"
            aria-label="Beat list"
          >
            <ListMusic className="h-5 w-5" />
          </button>
        </div>
      </div>

      <audio ref={audioRef} className="hidden" />
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(65%); }
          100% { transform: translateX(-100%); }
        }
      `}</style>
    </div>
  );
}
