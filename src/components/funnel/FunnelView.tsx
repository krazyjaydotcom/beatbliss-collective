import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, Mail, Lock, Play, Pause } from "lucide-react";
import { KrazyLogo } from "@/components/krazy-logo";

export interface FunnelContent {
  hero_eyebrow?: string;
  hero_title?: string;
  hero_subtitle?: string;
  download_label?: string;
  email_heading?: string;
  email_subheading?: string;
  email_placeholder?: string;
  email_button?: string;
  privacy_text?: string;
  show_sticky_player?: boolean;
}

export const DEFAULT_CONTENT: Required<FunnelContent> = {
  hero_eyebrow: "FREE BEAT",
  hero_title: "Watch This Before You Download",
  hero_subtitle: "Before you grab this beat, watch this quick video so you know how the catalog access works.",
  download_label: "Download this beat",
  email_heading: "Want access to more beats like this?",
  email_subheading: "Enter your email to get access to my beat subscription offer.",
  email_placeholder: "Enter your email",
  email_button: "Show Me The Beat Subscription Offer",
  privacy_text: "We respect your privacy. No spam, ever.",
  show_sticky_player: true,
};

export interface FunnelViewProps {
  funnel: {
    title: string;
    headline: string | null;
    video_url: string | null;
    audio_url: string | null;
    cover_url: string | null;
    download_url: string;
    beat_title: string | null;
  };
  content: FunnelContent;
  /** Form behavior */
  onEmailSubmit?: (email: string) => Promise<void> | void;
  /** When true, ignore the form action; used inside the editor preview */
  previewMode?: boolean;
  /** When true, embedded inside an editor — disables full-viewport scroll lock */
  embedded?: boolean;
}

function toEmbedUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com") && u.searchParams.get("v")) {
      return `https://www.youtube.com/embed/${u.searchParams.get("v")}`;
    }
    if (u.hostname === "youtu.be") {
      return `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
    }
    if (u.hostname.includes("loom.com") && u.pathname.startsWith("/share/")) {
      return `https://www.loom.com/embed/${u.pathname.replace("/share/", "")}`;
    }
    if (u.hostname.includes("vimeo.com")) {
      const id = u.pathname.split("/").filter(Boolean)[0];
      if (id) return `https://player.vimeo.com/video/${id}`;
    }
    return url;
  } catch {
    return null;
  }
}

export function FunnelView({ funnel, content, onEmailSubmit, previewMode, embedded }: FunnelViewProps) {
  const c = { ...DEFAULT_CONTENT, ...content };
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const embed = toEmbedUrl(funnel.video_url);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (previewMode || busy || !onEmailSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await onEmailSubmit(email.trim().toLowerCase());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  };

  return (
    <div className={embedded ? "bg-background" : "min-h-screen bg-background"}>
      <header className="border-b border-border">
        <div className="container mx-auto px-6 py-5 flex justify-center">
          <KrazyLogo className="text-xl md:text-2xl" />
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 py-8 sm:py-12 max-w-3xl pb-32">
        {c.hero_eyebrow && (
          <div className="text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-[10px] font-bold tracking-[0.2em] text-primary">
              {c.hero_eyebrow}
            </span>
          </div>
        )}

        <h1 className="mt-4 text-center text-4xl sm:text-5xl md:text-6xl font-black tracking-tight leading-[1.05]">
          {c.hero_title}
        </h1>

        {(c.hero_subtitle || funnel.headline) && (
          <p className="mt-4 text-center text-sm sm:text-base text-muted-foreground max-w-xl mx-auto">
            {funnel.headline || c.hero_subtitle}
          </p>
        )}

        {/* Video */}
        {embed ? (
          <div className="mt-8 rounded-2xl overflow-hidden border border-border bg-black aspect-video">
            <iframe
              src={embed}
              title="Watch this first"
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : funnel.cover_url ? (
          <div className="mt-8 rounded-2xl overflow-hidden border border-border bg-black aspect-video flex items-center justify-center">
            <img src={funnel.cover_url} alt={funnel.title} className="w-full h-full object-cover opacity-80" />
          </div>
        ) : (
          <div className="mt-8 rounded-2xl border border-dashed border-border bg-card aspect-video flex items-center justify-center text-sm text-muted-foreground">
            Add a video URL to display a player here
          </div>
        )}

        {/* Free download link */}
        <div className="mt-6 text-center">
          {previewMode ? (
            <span className="inline-flex items-center gap-2 text-primary font-semibold underline underline-offset-4">
              <Download className="h-4 w-4" />
              {c.download_label}
            </span>
          ) : (
            <a
              href={funnel.download_url}
              target="_blank"
              rel="noopener noreferrer"
              download
              className="inline-flex items-center gap-2 text-primary font-semibold hover:underline underline-offset-4"
            >
              <Download className="h-4 w-4" />
              {c.download_label}
            </a>
          )}
        </div>

        {/* Email card */}
        <form
          onSubmit={handleSubmit}
          className="mt-8 rounded-2xl border border-border bg-card/60 p-6 sm:p-8 backdrop-blur"
        >
          <div className="flex justify-center">
            <Mail className="h-5 w-5 text-primary" />
          </div>
          <h2 className="mt-3 text-xl sm:text-2xl font-bold text-center">{c.email_heading}</h2>
          <p className="mt-2 text-sm text-muted-foreground text-center">{c.email_subheading}</p>

          <div className="mt-5">
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={c.email_placeholder}
              disabled={busy || previewMode}
              className="h-12 text-base"
            />
          </div>

          <Button
            type="submit"
            variant="hero"
            size="lg"
            className="mt-3 w-full h-12 text-base font-bold"
            disabled={busy || previewMode}
          >
            {busy ? "Sending..." : c.email_button}
          </Button>

          {error && <p className="mt-3 text-sm text-destructive text-center">{error}</p>}

          <p className="mt-4 inline-flex items-center justify-center gap-1.5 w-full text-xs text-muted-foreground">
            <Lock className="h-3 w-3" />
            {c.privacy_text}
          </p>
        </form>
      </main>

      {/* Sticky audio player */}
      {c.show_sticky_player && funnel.audio_url && (
        <StickyAudio
          audioUrl={funnel.audio_url}
          title={funnel.beat_title || funnel.title}
          coverUrl={funnel.cover_url}
          embedded={embedded}
        />
      )}
    </div>
  );
}

function StickyAudio({
  audioUrl,
  title,
  coverUrl,
  embedded,
}: {
  audioUrl: string;
  title: string;
  coverUrl: string | null;
  embedded?: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onTime = () => {
      setCurrent(el.currentTime);
      if (el.duration) setProgress((el.currentTime / el.duration) * 100);
    };
    const onMeta = () => setDuration(el.duration || 0);
    const onEnd = () => setPlaying(false);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("loadedmetadata", onMeta);
    el.addEventListener("ended", onEnd);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("loadedmetadata", onMeta);
      el.removeEventListener("ended", onEnd);
    };
  }, []);

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
      setPlaying(false);
    } else {
      void el.play();
      setPlaying(true);
    }
  };

  const fmt = (s: number) => {
    if (!isFinite(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, "0")}`;
  };

  return (
    <div
      className={
        embedded
          ? "sticky bottom-0 left-0 right-0 border-t border-border bg-card/95 backdrop-blur"
          : "fixed bottom-0 left-0 right-0 border-t border-border bg-card/95 backdrop-blur z-40"
      }
    >
      <audio ref={audioRef} src={audioUrl} preload="metadata" />
      <div className="container mx-auto px-3 sm:px-6 py-3 flex items-center gap-3 sm:gap-4">
        {coverUrl ? (
          <img src={coverUrl} alt={title} className="h-12 w-12 sm:h-14 sm:w-14 rounded-md object-cover shrink-0" />
        ) : (
          <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-md bg-primary/20 shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate">{title}</p>
          <p className="text-[11px] text-muted-foreground truncate">by KRAZYJAYDOTCOM</p>
        </div>
        <button
          type="button"
          onClick={toggle}
          className="h-10 w-10 sm:h-11 sm:w-11 rounded-full bg-foreground text-background flex items-center justify-center shrink-0 hover:scale-105 transition-transform"
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
        </button>
        <div className="hidden md:flex flex-1 items-center gap-3 min-w-0">
          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
          <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
            {fmt(current)} / {fmt(duration)}
          </span>
        </div>
      </div>
    </div>
  );
}
