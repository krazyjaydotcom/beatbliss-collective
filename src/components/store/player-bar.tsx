import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  ListMusic,
  Music2,
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
  Volume2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatTime, usePlayer } from "@/components/store/player-provider";

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
  const [expanded, setExpanded] = useState(false);

  if (!current) {
    return (
      <div className="hidden shrink-0 border-t border-white/[0.08] bg-card/80 px-4 py-3 text-xs text-muted-foreground lg:block">
        Select a beat to start listening.
      </div>
    );
  }

  const max = duration || current.durationSeconds || 0;

  return (
    <div className="shrink-0 border-t border-white/[0.08] bg-card/95 backdrop-blur">
      {expanded ? (
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
        <div className="h-11 w-11 shrink-0 overflow-hidden rounded-md bg-white/[0.06]">
          {current.coverUrl ? (
            <img src={current.coverUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <Music2 className="h-4 w-4" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-foreground">{current.title}</div>
          <div className="truncate text-xs text-muted-foreground">
            {status === "error" ? (
              <span className="text-destructive">Preview failed to load.</span>
            ) : status === "loading" ? (
              "Loading…"
            ) : (
              current.producerName
            )}
          </div>
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
            onClick={() => setExpanded((v) => !v)}
            aria-label={expanded ? "Hide queue" : "Show queue"}
            aria-expanded={expanded}
            className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
          >
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
