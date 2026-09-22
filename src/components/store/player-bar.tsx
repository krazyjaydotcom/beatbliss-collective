import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  ChevronDown,
  ChevronUp,
  ListMusic,
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
  Volume2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPrice, formatTime, usePlayer } from "@/components/store/player-provider";
import { tierPriceCents } from "@/lib/licensing";
import { CoverArt } from "@/components/store/cover-art";

export function PlayerBar() {
  const {
    current,
    queue,
    isPlaying,
    progress,
    duration,
    volume,
    status,
    toggle,
    seek,
    next,
    previous,
    setVolume,
    retry,
    play,
  } = usePlayer();
  const navigate = useNavigate();
  const [queueOpen, setQueueOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!sheetOpen) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSheetOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheetOpen]);

  useEffect(() => {
    if (!current) {
      setSheetOpen(false);
      setQueueOpen(false);
    }
  }, [current]);

  if (!current) {
    return (
      <div className="hidden shrink-0 border-t border-white/[0.08] bg-card/80 px-4 py-3 text-xs text-muted-foreground lg:block">
        Select a beat to start listening.
      </div>
    );
  }

  const max = duration || current.durationSeconds || 0;
  const openLicense = () => {
    setSheetOpen(false);
    navigate({
      to: "/",
      search: (prev: Record<string, unknown>) => ({
        ...prev,
        beat: current.slug ?? current.id,
      }),
    });
  };

  const statusLine =
    status === "error" ? (
      <span className="text-destructive">Preview failed to load.</span>
    ) : status === "loading" ? (
      "Loading…"
    ) : (
      current.producerName
    );

  return (
    <>
      <div className="shrink-0 border-t border-white/[0.08] bg-card/95 backdrop-blur">
        {queueOpen ? (
          <div className="max-h-[50dvh] overflow-y-auto border-b border-white/[0.08] px-4 py-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <ListMusic className="h-3.5 w-3.5" /> Up next ({queue.length})
            </div>
            <ul className="space-y-1">
              {queue.map((b) => (
                <li key={b.id}>
                  <button
                    type="button"
                    onClick={() => play(b)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-white/[0.05]",
                      b.id === current.id ? "text-primary" : "text-foreground",
                    )}
                  >
                    <span className="truncate">{b.title}</span>
                    <span className="ml-auto shrink-0 text-xs tabular-nums text-muted-foreground">
                      {formatTime(b.durationSeconds)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="flex items-center gap-3 px-3 py-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))] sm:px-4 lg:pb-2.5">
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            aria-label={`Open now playing: ${current.title}`}
            className="h-11 w-11 shrink-0 overflow-hidden rounded-md bg-white/[0.06] lg:pointer-events-none"
          >
            <CoverArt title={current.title} seed={current.id} src={current.coverUrl} />
          </button>

          <div className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="block w-full min-w-0 text-left lg:pointer-events-none"
              aria-label={`Open now playing: ${current.title}`}
            >
              <span className="block truncate text-sm font-medium text-foreground">
                {current.title}
              </span>
              <span className="block truncate text-xs text-muted-foreground">{statusLine}</span>
            </button>
            <div className="mt-1.5 hidden items-center gap-2 sm:flex">
              <span className="w-9 text-[11px] tabular-nums text-muted-foreground">
                {formatTime(progress)}
              </span>
              <input
                type="range"
                min={0}
                max={max || 1}
                step={0.1}
                value={Math.min(progress, max || 1)}
                onChange={(e) => seek(Number(e.target.value))}
                aria-label="Seek"
                className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-white/15 accent-[var(--primary)]"
              />
              <span className="w-9 text-[11px] tabular-nums text-muted-foreground">
                {formatTime(max)}
              </span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
            {status === "error" ? (
              <button
                type="button"
                onClick={retry}
                aria-label="Retry preview"
                className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            ) : null}
            <button
              type="button"
              onClick={previous}
              aria-label="Previous beat"
              className="hidden h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:text-foreground sm:flex"
            >
              <SkipBack className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => toggle()}
              aria-label={isPlaying ? "Pause" : "Play"}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/90"
            >
              {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </button>
            <button
              type="button"
              onClick={next}
              aria-label="Next beat"
              className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
            >
              <SkipForward className="h-4 w-4" />
            </button>
            <div className="hidden items-center gap-2 pl-2 lg:flex">
              <Volume2 className="h-4 w-4 text-muted-foreground" />
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                aria-label="Volume"
                className="h-1 w-20 cursor-pointer appearance-none rounded-full bg-white/15 accent-[var(--primary)]"
              />
            </div>
            <button
              type="button"
              onClick={() => setQueueOpen((v) => !v)}
              aria-label={queueOpen ? "Hide queue" : "Show queue"}
              aria-expanded={queueOpen}
              className="hidden h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:text-foreground lg:flex"
            >
              {queueOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              aria-label="Open now playing"
              aria-expanded={sheetOpen}
              className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:text-foreground lg:hidden"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {sheetOpen ? (
        <div
          className="fixed inset-0 z-[70] flex flex-col bg-background lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Now playing"
        >
          <div className="flex items-center justify-between px-4 pt-[calc(0.75rem+env(safe-area-inset-top))]">
            <button
              ref={closeRef}
              type="button"
              onClick={() => setSheetOpen(false)}
              aria-label="Close now playing"
              className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
            >
              <ChevronDown className="h-5 w-5" />
            </button>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Now playing
            </span>
            <button
              type="button"
              onClick={() => setQueueOpen((v) => !v)}
              aria-label={queueOpen ? "Hide queue" : "Show queue"}
              aria-expanded={queueOpen}
              className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
            >
              <ListMusic className="h-5 w-5" />
            </button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-4">
            <div className="mx-auto aspect-square w-full max-w-[280px] shrink-0 overflow-hidden rounded-2xl bg-white/[0.06]">
              <CoverArt
                title={current.title}
                seed={current.id}
                src={current.coverUrl}
                textClassName="text-4xl"
              />
            </div>

            <div className="text-center">
              <h2 className="truncate text-lg font-semibold tracking-tight">{current.title}</h2>
              <p className="mt-0.5 truncate text-sm text-muted-foreground">{statusLine}</p>
            </div>

            <div>
              <input
                type="range"
                min={0}
                max={max || 1}
                step={0.1}
                value={Math.min(progress, max || 1)}
                onChange={(e) => seek(Number(e.target.value))}
                aria-label="Seek"
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/15 accent-[var(--primary)]"
              />
              <div className="mt-1.5 flex justify-between text-[11px] tabular-nums text-muted-foreground">
                <span>{formatTime(progress)}</span>
                <span>{formatTime(max)}</span>
              </div>
            </div>

            <div className="flex items-center justify-center gap-6">
              <button
                type="button"
                onClick={previous}
                aria-label="Previous beat"
                className="flex h-12 w-12 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
              >
                <SkipBack className="h-6 w-6" />
              </button>
              <button
                type="button"
                onClick={() => toggle()}
                aria-label={isPlaying ? "Pause" : "Play"}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground"
              >
                {isPlaying ? <Pause className="h-7 w-7" /> : <Play className="h-7 w-7" />}
              </button>
              <button
                type="button"
                onClick={next}
                aria-label="Next beat"
                className="flex h-12 w-12 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
              >
                <SkipForward className="h-6 w-6" />
              </button>
            </div>

            {status === "error" ? (
              <button
                type="button"
                onClick={retry}
                className="mx-auto flex h-11 items-center gap-2 rounded-full border border-white/12 px-5 text-sm font-medium"
              >
                <RotateCcw className="h-4 w-4" /> Retry preview
              </button>
            ) : null}

            <button
              type="button"
              onClick={openLicense}
              className="h-12 w-full rounded-xl bg-primary text-sm font-semibold uppercase tracking-wide text-primary-foreground"
            >
              License this beat · {formatPrice(tierPriceCents(current, "nonexclusive") ?? current.priceCents)}
            </button>

            {queueOpen ? (
              <div className="border-t border-white/[0.08] pt-4">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Up next ({queue.length})
                </div>
                <ul className="space-y-1">
                  {queue.map((b) => (
                    <li key={b.id}>
                      <button
                        type="button"
                        onClick={() => play(b)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left text-sm",
                          b.id === current.id ? "text-primary" : "text-foreground",
                        )}
                      >
                        <span className="truncate">{b.title}</span>
                        <span className="ml-auto shrink-0 text-xs tabular-nums text-muted-foreground">
                          {formatTime(b.durationSeconds)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
