import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ExternalLink, Heart, Pause, Play, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StoreBeat } from "@/lib/store.functions";
import { formatTime } from "@/components/store/player-provider";
import { LicenseCheckout, LicenseTerms } from "@/components/store/license-panel";
import { CoverArt } from "@/components/store/cover-art";
import { ShareBeatButton } from "@/components/store/share-beat-button";

export function BeatDetail({
  beat,
  isCurrent,
  isPlaying,
  isSaved,
  onPlay,
  onSave,
  onClose,
}: {
  beat: StoreBeat;
  isCurrent: boolean;
  isPlaying: boolean;
  isSaved: boolean;
  onPlay: () => void;
  onSave: () => void;
  onClose?: () => void;
}) {
  const [termsOpen, setTermsOpen] = useState(false);
  const [paying, setPaying] = useState(false);
  const meta = [
    beat.genre,
    beat.bpm ? `${beat.bpm} BPM` : null,
    beat.musicKey,
    beat.durationSeconds ? formatTime(beat.durationSeconds) : null,
  ].filter(Boolean) as string[];

  if (paying) {
    return (
      <div className="animate-in fade-in duration-300 motion-reduce:animate-none">
        <LicenseCheckout beat={beat} paying onPayingChange={setPaying} />
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-300 motion-reduce:animate-none space-y-5">
      {onClose ? (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close details"
            className="flex h-9 items-center gap-1.5 rounded-full border border-white/12 px-3 text-xs font-medium text-muted-foreground transition-colors hover:border-white/25 hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" /> Close details
          </button>
        </div>
      ) : null}
      <div className="flex gap-4">
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-white/[0.06]">
          <CoverArt
            title={beat.title}
            seed={beat.id}
            src={beat.coverUrl}
            textClassName="text-lg"
          />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-semibold tracking-tight text-foreground">
            {beat.title}
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{beat.producerName}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {meta.map((m) => (
              <span
                key={m}
                className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-muted-foreground"
              >
                {m}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPlay}
          className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-white/12 text-sm font-medium text-foreground transition-colors hover:border-primary/60 hover:text-primary"
        >
          {isCurrent && isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          {isCurrent && isPlaying ? "Pause preview" : "Play preview"}
        </button>
        <button
          type="button"
          onClick={onSave}
          aria-pressed={isSaved}
          aria-label={isSaved ? "Remove from saved" : "Save beat"}
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/12 text-muted-foreground transition-colors hover:text-foreground"
        >
          <Heart className={cn("h-4 w-4", isSaved && "fill-primary text-primary")} />
        </button>
        <ShareBeatButton
          beatRef={beat.slug ?? beat.id}
          title={beat.title}
          label="Share"
          className="h-11 shrink-0"
        />
      </div>

      <div className="h-px bg-white/[0.08]" />

      <LicenseCheckout beat={beat} paying={false} onPayingChange={setPaying} />

      <button
        type="button"
        onClick={() => setTermsOpen((v) => !v)}
        className="text-xs font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground"
      >
        {termsOpen ? "Hide license terms" : "Read the full license terms"}
      </button>
      {termsOpen ? <LicenseTerms /> : null}

      {beat.slug ? (
        <>
          <div className="h-px bg-white/[0.08]" />
          <Link
            to="/beats/$slug"
            params={{ slug: beat.slug }}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            Open full beat page · exclusive &amp; custom work inquiry
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </>
      ) : null}
    </div>
  );
}

export function BeatDetailDrawer({
  beat,
  onClose,
  ...rest
}: {
  beat: StoreBeat | null;
  onClose: () => void;
  isCurrent: boolean;
  isPlaying: boolean;
  isSaved: boolean;
  onPlay: () => void;
  onSave: () => void;
}) {
  useEffect(() => {
    if (!beat) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [beat, onClose]);

  if (!beat) return null;

  return (
    <div className="fixed inset-0 z-50 xl:hidden" role="dialog" aria-modal="true" aria-label={`${beat.title} details`}>
      <button
        type="button"
        aria-label="Close details"
        onClick={onClose}
        className="absolute inset-0 h-full w-full bg-black/70 backdrop-blur-sm"
      />
      <div className="absolute inset-x-0 top-0 h-[100dvh] overflow-y-auto border-t border-white/10 bg-card p-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl sm:inset-y-0 sm:left-auto sm:right-0 sm:h-auto sm:max-h-none sm:w-[420px] sm:rounded-none sm:rounded-l-2xl sm:border-l sm:border-t-0">
        <div className="mb-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close details"
            className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <BeatDetail beat={beat} {...rest} />
      </div>
    </div>
  );
}
