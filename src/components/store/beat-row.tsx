import { Heart, Pause, Play, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StoreBeat } from "@/lib/store.functions";
import { formatPrice, formatTime } from "@/components/store/player-provider";
import { CoverArt } from "@/components/store/cover-art";
import { tierPriceCents } from "@/lib/licensing";

type Props = {
  beat: StoreBeat;
  index?: number;
  rank?: number;
  isCurrent: boolean;
  isPlaying: boolean;
  isSaved: boolean;
  onPlay: () => void;
  onSave: () => void;
  onOpen: () => void;
};

export function BeatRow({
  beat,
  rank,
  isCurrent,
  isPlaying,
  isSaved,
  onPlay,
  onSave,
  onOpen,
}: Props) {
  const playing = isCurrent && isPlaying;

  return (
    <div
      className={cn(
        "group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-white/[0.06] px-3 py-2.5 transition-colors sm:gap-4 sm:px-4",
        isCurrent ? "bg-primary/[0.08]" : "hover:bg-white/[0.04]",
      )}
    >
      <div className="flex items-center gap-3">
        {typeof rank === "number" ? (
          <span
            className={cn(
              "w-6 shrink-0 text-right text-[13px] font-semibold tabular-nums",
              isCurrent ? "text-primary" : "text-muted-foreground/70",
            )}
          >
            {rank}
          </span>
        ) : null}
        <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-md bg-white/[0.06] sm:h-12 sm:w-12">
          <CoverArt title={beat.title} seed={beat.id} src={beat.coverUrl} />
          <button
            type="button"
            onClick={onPlay}
            aria-label={playing ? `Pause ${beat.title}` : `Play ${beat.title}`}
            className={cn(
              "absolute inset-0 flex items-center justify-center bg-black/55 text-white transition-opacity",
              playing || isCurrent ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
            )}
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={onOpen}
        className="min-w-0 text-left"
        aria-label={`Open details for ${beat.title}`}
      >
        <div
          className={cn(
            "truncate text-[15px] font-medium",
            isCurrent ? "text-primary" : "text-foreground",
          )}
        >
          {beat.title}
        </div>
        <div className="mt-0.5 flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
          <span className="truncate">{beat.producerName}</span>
          {beat.genre ? (
            <>
              <span aria-hidden className="hidden sm:inline">·</span>
              <span className="hidden truncate sm:inline">{beat.genre}</span>
            </>
          ) : null}
          {beat.bpm ? (
            <>
              <span aria-hidden className="hidden sm:inline">·</span>
              <span className="hidden shrink-0 tabular-nums sm:inline">{beat.bpm} BPM</span>
            </>
          ) : null}
        </div>
      </button>

      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        <span className="hidden w-12 text-right text-xs tabular-nums text-muted-foreground md:inline">
          {formatTime(beat.durationSeconds)}
        </span>
        <button
          type="button"
          onClick={onSave}
          aria-label={isSaved ? `Remove ${beat.title} from saved` : `Save ${beat.title}`}
          aria-pressed={isSaved}
          className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
        >
          <Heart className={cn("h-4 w-4", isSaved && "fill-primary text-primary")} />
        </button>
        <button
          type="button"
          onClick={onOpen}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-white/12 px-3 text-xs font-semibold tabular-nums text-foreground transition-colors hover:border-primary/60 hover:text-primary sm:px-4"
        >
          <Tag className="h-3.5 w-3.5 opacity-70" aria-hidden />
          {formatPrice(tierPriceCents(beat, "nonexclusive") ?? beat.priceCents)}
        </button>
      </div>
    </div>
  );
}
