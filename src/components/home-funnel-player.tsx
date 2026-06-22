import { useEffect, useRef, useState } from "react";
import { Pause, Play, SkipBack, SkipForward, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useServerFn } from "@tanstack/react-start";
import { getHomePlayerQueue } from "@/lib/home-player.functions";
import {
  FREE_PLAY_LIMIT,
  getPlayCount,
  hasReachedPlayLimit,
  recordBeatPlayed,
  rememberSignupSourceBeat,
} from "@/lib/funnel-attribution";
import { JoinCatalogModal } from "@/components/join-catalog-modal";

type Beat = {
  id: string;
  title: string;
  producer_name: string | null;
  genre: string | null;
  bpm: number | null;
  cover_url: string | null;
  audio_url_tagged: string | null;
};

interface Props {
  beatId?: string | null;
  onApplyForAccess: () => void;
}

const MIN_LISTEN_SECONDS = 10;

export function HomeFunnelPlayer({ beatId, onApplyForAccess }: Props) {
  const fetchQueue = useServerFn(getHomePlayerQueue);
  const [queue, setQueue] = useState<Beat[]>([]);
  const [featuredId, setFeaturedId] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [plays, setPlays] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const listenedRef = useRef(0);
  const lastTimeRef = useRef(0);

  // Load queue
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetchQueue({ data: { beatId: beatId ?? null } });
      if (cancelled) return;
      setQueue(res.queue);
      setFeaturedId(res.featured?.id ?? null);
      if (beatId) rememberSignupSourceBeat(beatId);
    })();
    return () => {
      cancelled = true;
    };
  }, [beatId, fetchQueue]);

  // Sync play count from storage
  useEffect(() => {
    setPlays(getPlayCount());
  }, []);

  const current = queue[index];

  // Auto-play featured beat on first load
  useEffect(() => {
    if (!current || !beatId || index !== 0) return;
    const a = audioRef.current;
    if (!a) return;
    a.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
  }, [beatId, current, index]);

  function tryPlay() {
    if (hasReachedPlayLimit()) {
      setShowModal(true);
      return;
    }
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      a.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    } else {
      a.pause();
      setIsPlaying(false);
    }
  }

  function countCurrentAsPlayed() {
    if (!current) return;
    const next = recordBeatPlayed(current.id);
    setPlays(next);
    if (next >= FREE_PLAY_LIMIT) setShowModal(true);
  }

  function changeTrack(nextIdx: number) {
    if (listenedRef.current >= MIN_LISTEN_SECONDS) countCurrentAsPlayed();
    listenedRef.current = 0;
    lastTimeRef.current = 0;
    if (nextIdx < 0 || nextIdx >= queue.length) {
      setIsPlaying(false);
      return;
    }
    setIndex(nextIdx);
    // Play after the audio element loads the new src
    setTimeout(() => {
      if (hasReachedPlayLimit()) {
        setShowModal(true);
        setIsPlaying(false);
        return;
      }
      audioRef.current?.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    }, 50);
  }

  function onTimeUpdate() {
    const a = audioRef.current;
    if (!a) return;
    setProgress(a.currentTime);
    // Only count forward progression (not scrubs)
    const delta = a.currentTime - lastTimeRef.current;
    if (delta > 0 && delta < 2) listenedRef.current += delta;
    lastTimeRef.current = a.currentTime;
  }

  function onEnded() {
    countCurrentAsPlayed();
    listenedRef.current = 0;
    lastTimeRef.current = 0;
    if (hasReachedPlayLimit()) {
      setShowModal(true);
      setIsPlaying(false);
      return;
    }
    if (index + 1 < queue.length) {
      setIndex(index + 1);
      setTimeout(() => {
        audioRef.current?.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
      }, 50);
    } else {
      setIsPlaying(false);
    }
  }

  function onLoadedMetadata() {
    const a = audioRef.current;
    if (!a) return;
    setDuration(a.duration || 0);
    setProgress(0);
  }

  function onSeek(e: React.ChangeEvent<HTMLInputElement>) {
    const a = audioRef.current;
    if (!a) return;
    const t = Number(e.target.value);
    a.currentTime = t;
    lastTimeRef.current = t;
    setProgress(t);
  }

  if (!current) return null;
  const isFeatured = current.id === featuredId;
  const remaining = Math.max(0, FREE_PLAY_LIMIT - plays);

  return (
    <>
      <audio
        ref={audioRef}
        src={current.audio_url_tagged ?? undefined}
        onTimeUpdate={onTimeUpdate}
        onEnded={onEnded}
        onLoadedMetadata={onLoadedMetadata}
        preload="metadata"
      />
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card/95 backdrop-blur-xl shadow-2xl">
        <div className="mx-auto max-w-7xl px-4 py-1.5">
          <div className="flex items-center gap-3">
            {/* Artwork + title */}
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <div className="relative h-8 w-8 flex-shrink-0 overflow-hidden rounded bg-muted">
                {current.cover_url ? (
                  <img src={current.cover_url} alt={current.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                    <Sparkles className="h-3 w-3" />
                  </div>
                )}
              </div>
              <div className="min-w-0 leading-tight">
                {isFeatured && (
                  <p className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-primary">
                    <Sparkles className="h-2.5 w-2.5" /> Sent to you
                  </p>
                )}
                <p className="truncate text-xs font-bold">{current.title}</p>
                <p className="truncate text-[10px] text-muted-foreground">
                  {current.producer_name ?? "MYBEATCATALOG"}
                  {current.bpm ? ` • ${current.bpm} BPM` : ""}
                </p>
              </div>
            </div>

            {/* Controls */}
            <div className="flex flex-1 flex-col items-center gap-0.5">
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => changeTrack(index - 1)}
                  disabled={index === 0}
                  aria-label="Previous"
                >
                  <SkipBack className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  className="h-7 w-7 rounded-full"
                  onClick={tryPlay}
                  aria-label={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => changeTrack(index + 1)}
                  disabled={index >= queue.length - 1}
                  aria-label="Next"
                >
                  <SkipForward className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="flex w-full max-w-md items-center gap-2 text-[10px] text-muted-foreground">
                <span className="tabular-nums">{formatTime(progress)}</span>
                <input
                  type="range"
                  min={0}
                  max={duration || 0}
                  step={0.1}
                  value={progress}
                  onChange={onSeek}
                  className="h-1 flex-1 cursor-pointer accent-primary"
                  aria-label="Seek"
                />
                <span className="tabular-nums">{formatTime(duration)}</span>
              </div>
            </div>

            {/* Counter + Join CTA — always visible */}
            <div className="flex shrink-0 items-center justify-end gap-2 sm:gap-3">
              <div className="hidden text-right sm:block">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Previews left</p>
                <p className="text-sm font-bold">
                  {remaining} / {FREE_PLAY_LIMIT}
                </p>
              </div>
              <Button size="sm" className="font-black uppercase tracking-wider" onClick={() => setShowModal(true)}>
                <span className="hidden sm:inline">Get Access</span>
                <span className="sm:hidden">$49</span>
              </Button>
            </div>
          </div>

          {/* Queue strip */}
          <div className="mt-1 hidden gap-1.5 overflow-x-auto sm:flex">
            {queue.map((b, i) => (
              <button
                key={b.id}
                onClick={() => changeTrack(i)}
                className={`flex-shrink-0 rounded border px-1.5 py-0.5 text-[10px] transition ${
                  i === index
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {b.id === featuredId && "🎧 "}
                {i + 1}. {b.title}
              </button>
            ))}
          </div>
        </div>
      </div>

      <JoinCatalogModal
        open={showModal}
        onOpenChange={setShowModal}
        onApplyForAccess={onApplyForAccess}
      />
    </>
  );
}

function formatTime(s: number) {
  if (!s || !isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}
