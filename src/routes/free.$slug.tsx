import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Download, Loader2, Lock, Pause, Play } from "lucide-react";
import {
  captureFreeDownloadLead,
  getFreeDownloadBeat,
  type FreeDownloadBeat,
  type FreeDownloadTag,
} from "@/lib/free-download.functions";
import { TIER_META, TIER_ORDER, tierPriceCents, type LicenseTier } from "@/lib/licensing";
import { renderTaggedBeatBuffer } from "@/lib/tagged-export";
import { encodeMp3 } from "@/lib/audio-convert";
import { downloadBlob } from "@/lib/tagged-export";
import { trackPurchaseFunnel } from "@/lib/purchase-attribution";
import { InlineCheckout } from "@/components/store/inline-checkout";
import { cn } from "@/lib/utils";

const SITE = "https://mybeatcatalog.com";

export const Route = createFileRoute("/free/$slug")({
  loader: async ({ params }) => {
    const res = await getFreeDownloadBeat({ data: { slug: params.slug } });
    if (!res.beat) throw notFound();
    return res;
  },
  head: ({ loaderData, params }) => {
    const b = loaderData?.beat;
    if (!b) {
      return {
        meta: [{ title: "Unavailable — MYBEATCATALOG" }, { name: "robots", content: "noindex" }],
      };
    }
    const title = `Free download: ${b.title} — MYBEATCATALOG`;
    const desc = `Grab a free tagged MP3 of "${b.title}" by ${b.producerName}, or license the beat instantly.`;
    const url = `${SITE}/free/${params.slug}`;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "product" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary_large_image" },
        ...(b.coverUrl ? [{ property: "og:image", content: b.coverUrl }] : []),
        ...(b.coverUrl ? [{ name: "twitter:image", content: b.coverUrl }] : []),
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  notFoundComponent: () => (
    <Shell>
      <h1 className="text-xl font-black">Beat not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">This free download link is no longer active.</p>
      <Link to="/" className="mt-4 inline-block text-sm font-semibold text-primary">
        Browse the catalog
      </Link>
    </Shell>
  ),
  errorComponent: () => (
    <Shell>
      <p className="text-sm text-muted-foreground">Something went wrong. Please refresh.</p>
    </Shell>
  ),
  component: FreeDownloadPage,
});

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-5 text-center text-foreground">
      <div>{children}</div>
    </div>
  );
}

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function initials(title: string) {
  return title
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function FreeDownloadPage() {
  const { beat, tag } = Route.useLoaderData() as {
    beat: FreeDownloadBeat;
    tag: FreeDownloadTag;
  };
  const [step, setStep] = useState<"capture" | "unlocked">("capture");

  useEffect(() => {
    trackPurchaseFunnel("free_landing_view", beat.id);
  }, [beat.id]);

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <div
        className="mx-auto w-full max-w-lg px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]"
      >
        <BeatHeader beat={beat} />

        <div className="relative mt-4">
          <div
            className={cn(
              "transition-all duration-300",
              step === "capture" ? "opacity-100" : "pointer-events-none absolute inset-0 opacity-0",
            )}
          >
            <CaptureCard beat={beat} onDone={() => setStep("unlocked")} />
          </div>
          <div
            className={cn(
              "transition-all duration-300",
              step === "unlocked" ? "opacity-100" : "pointer-events-none absolute inset-0 opacity-0",
            )}
          >
            {step === "unlocked" ? <UnlockedCard beat={beat} tag={tag} /> : null}
          </div>
        </div>

        <p className="mt-6 text-center text-[11px] text-muted-foreground">
          <Link to="/" className="underline underline-offset-4">
            Browse the full catalog
          </Link>
        </p>
      </div>
    </div>
  );
}

function BeatHeader({ beat }: { beat: FreeDownloadBeat }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) {
      void el.play().catch(() => setPlaying(false));
    } else {
      el.pause();
    }
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-card p-4">
      <div className="flex items-center gap-3">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/[0.04]">
          {beat.coverUrl ? (
            <img src={beat.coverUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-lg font-black text-muted-foreground">
              {initials(beat.title)}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-black leading-tight">{beat.title}</h1>
          <p className="truncate text-xs text-muted-foreground">{beat.producerName}</p>
          <p className="mt-1 truncate text-[11px] uppercase tracking-wide text-muted-foreground">
            {[beat.genre, beat.bpm ? `${beat.bpm} BPM` : null, beat.musicKey]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? "Pause preview" : "Play preview"}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
        >
          {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 translate-x-[1px]" />}
        </button>
      </div>
      <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-white/10">
        <div className="h-full bg-primary transition-[width]" style={{ width: `${progress}%` }} />
      </div>
      {beat.previewUrl ? (
        <audio
          ref={audioRef}
          src={beat.previewUrl}
          preload="metadata"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          onTimeUpdate={(e) => {
            const el = e.currentTarget;
            if (el.duration) setProgress((el.currentTime / el.duration) * 100);
          }}
        />
      ) : null}
    </div>
  );
}

function CaptureCard({ beat, onDone }: { beat: FreeDownloadBeat; onDone: () => void }) {
  const capture = useServerFn(captureFreeDownloadLead);
  const [email, setEmail] = useState("");
  const [hp, setHp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await capture({ data: { beatId: beat.id, email, hp } });
      if (!res.ok) throw new Error("We couldn't save that. Please try again.");
      trackPurchaseFunnel("free_lead_captured", beat.id);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="rounded-2xl border border-primary/30 bg-card p-5">
      <h2 className="text-base font-black">Get this beat free</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Enter your email and we'll unlock the free tagged MP3 right here.
      </p>
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@email.com"
        autoComplete="email"
        inputMode="email"
        className="mt-4 h-12 w-full rounded-xl border border-white/12 bg-background px-4 text-base outline-none focus:border-primary/60"
      />
      <input
        type="text"
        tabIndex={-1}
        autoComplete="off"
        value={hp}
        onChange={(e) => setHp(e.target.value)}
        aria-hidden
        className="hidden"
      />
      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
      <button
        type="submit"
        disabled={busy}
        className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-primary-foreground disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        Get the free MP3
      </button>
      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
        The free version carries the producer voice tag. No spam — unsubscribe anytime.
      </p>
    </form>
  );
}

function UnlockedCard({ beat, tag }: { beat: FreeDownloadBeat; tag: FreeDownloadTag }) {
  const [state, setState] = useState<"idle" | "working" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [tier, setTier] = useState<LicenseTier>("nonexclusive");
  const [expanded, setExpanded] = useState<LicenseTier | null>(null);
  const [checkout, setCheckout] = useState(false);

  const download = useCallback(async () => {
    if (!beat.previewUrl || !tag.tagUrl) {
      setError("The free version isn't available for this beat right now.");
      return;
    }
    setState("working");
    setError(null);
    try {
      const buffer = await renderTaggedBeatBuffer(beat.previewUrl, tag.tagUrl, {
        intervalSeconds: tag.intervalSeconds,
        startOffsetSeconds: tag.startOffsetSeconds,
        volume: tag.volume,
      });
      const blob = encodeMp3(buffer, 192);
      downloadBlob(blob, `${beat.title.replace(/[^a-zA-Z0-9]+/g, "_")}_tagged.mp3`);
      trackPurchaseFunnel("free_download", beat.id);
      setState("done");
    } catch {
      setState("idle");
      setError("The file couldn't be prepared. Please try again.");
    }
  }, [beat, tag]);

  const price = tierPriceCents(beat, tier);

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-primary/40 bg-primary/[0.07] p-5">
        <p className="text-xs font-bold uppercase tracking-wider text-primary">You're in</p>
        <h2 className="mt-1 text-base font-black">Your free tagged MP3 is ready</h2>
        <button
          type="button"
          onClick={() => void download()}
          disabled={state === "working"}
          className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-primary-foreground disabled:opacity-60"
        >
          {state === "working" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Preparing your file…
            </>
          ) : state === "done" ? (
            <>
              <Check className="h-4 w-4" /> Downloaded — tap for another copy
            </>
          ) : (
            <>
              <Download className="h-4 w-4" /> Download free tagged MP3
            </>
          )}
        </button>
        {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          Free version is tagged and for auditioning only. A license removes the tag and grants
          usage rights.
        </p>
      </div>

      {checkout ? (
        <div className="rounded-2xl border border-white/10 bg-card p-4">
          <button
            type="button"
            onClick={() => setCheckout(false)}
            className="mb-3 text-xs font-semibold text-muted-foreground underline underline-offset-4"
          >
            Back to licenses
          </button>
          <InlineCheckout items={[{ beatId: beat.id, tier }]} />
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-card p-4">
          <h3 className="flex items-center gap-2 text-sm font-black">
            <Lock className="h-4 w-4 text-primary" /> License this beat
          </h3>
          <div className="mt-3 space-y-2">
            {TIER_ORDER.map((t) => {
              const meta = TIER_META[t];
              const cents = tierPriceCents(beat, t);
              const active = tier === t;
              return (
                <div
                  key={t}
                  className={cn(
                    "rounded-xl border p-3 transition-colors",
                    active ? "border-primary bg-primary/[0.06]" : "border-white/10",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setTier(t);
                      trackPurchaseFunnel("license_selected", beat.id, t);
                    }}
                    className="flex w-full items-center justify-between gap-3 text-left"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{meta.label}</span>
                      <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                        {meta.blurb}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-black">
                      {cents ? money(cents) : "Inquire"}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpanded(expanded === t ? null : t)}
                    className="mt-2 text-[11px] font-semibold text-primary underline underline-offset-4"
                  >
                    {expanded === t ? "Hide details" : "License details"}
                  </button>
                  {expanded === t ? (
                    <ul className="mt-2 space-y-1">
                      {meta.bullets.map((b) => (
                        <li key={b} className="flex gap-2 text-[11px] text-muted-foreground">
                          <Check className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                          {b}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              );
            })}
          </div>
          <button
            type="button"
            disabled={!price}
            onClick={() => {
              trackPurchaseFunnel("buy_now_clicked", beat.id, tier);
              setCheckout(true);
            }}
            className="mt-3 flex h-12 w-full items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground disabled:opacity-60"
          >
            Buy now{price ? ` — ${money(price)}` : ""}
          </button>
        </div>
      )}
    </div>
  );
}
