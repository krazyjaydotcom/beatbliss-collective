import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock, Play, Pause } from "lucide-react";
import { KrazyLogo } from "@/components/krazy-logo";

export type SectionKey = "hero" | "video" | "download" | "email";

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
  /** Pixel size for the main hero title */
  hero_title_size?: number;
  /** Pixel size for the hero subtitle */
  hero_subtitle_size?: number;
  /** Pixel size for the email-card heading */
  email_heading_size?: number;
  /** Pixel size for body / button text on the page */
  body_size?: number;
  /** Order of the page sections */
  section_order?: SectionKey[];
  /** Padding controls (px) */
  padding_header?: number;
  padding_hero?: number;
  padding_video_top?: number;
  padding_email_top?: number;
}

export const DEFAULT_CONTENT: Required<FunnelContent> = {
  hero_eyebrow: "PRIVATE ACCESS",
  hero_title: "Watch This Before You Join",
  hero_subtitle: "Watch the video below, then enter your email to get access to the exclusive membership offer.",
  download_label: "Download this beat",
  email_heading: "Ready to hear more?",
  email_subheading: "Enter your email and I'll send you the full details on the membership offer.",
  email_placeholder: "Enter your email",
  email_button: "Show Me The Offer",
  privacy_text: "We respect your privacy. No spam, ever.",
  show_sticky_player: false,
  hero_title_size: 56,
  hero_subtitle_size: 16,
  email_heading_size: 22,
  body_size: 14,
  section_order: ["hero", "video", "email"],
  padding_header: 12,
  padding_hero: 12,
  padding_video_top: 0,
  padding_email_top: 16,
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
  onEmailSubmit?: (email: string) => Promise<void> | void;
  previewMode?: boolean;
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
  // Ensure section_order always contains all sections
  const order: SectionKey[] = (() => {
    const all: SectionKey[] = ["hero", "video", "download", "email"];
    const provided = (c.section_order || []).filter((k) => all.includes(k));
    const missing = all.filter((k) => !provided.includes(k));
    return [...provided, ...missing];
  })();

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

  const heroBlock = (
    <div key="hero" className="text-center px-4" style={{ paddingTop: c.padding_hero, paddingBottom: c.padding_hero }}>
      <p
        className="font-semibold text-foreground"
        style={{ fontSize: `${c.hero_title_size > 36 ? 18 : c.hero_title_size}px` }}
      >
        {funnel.headline || c.hero_title}
      </p>
    </div>
  );

  const videoBlock = (
    <div key="video" className="w-full" style={{ paddingTop: c.padding_video_top }}>
      {embed ? (
        <div className="overflow-hidden bg-black aspect-video">
          <iframe
            src={embed}
            title="Watch this first"
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : funnel.cover_url ? (
        <div className="overflow-hidden bg-black aspect-video flex items-center justify-center">
          <img src={funnel.cover_url} alt={funnel.title} className="w-full h-full object-cover opacity-80" />
        </div>
      ) : (
        <div className="border border-dashed border-border bg-card aspect-video flex items-center justify-center text-sm text-muted-foreground">
          Add a video URL to display a player here
        </div>
      )}
    </div>
  );

  const downloadBlock = <div key="download" className="hidden" />;

  const emailBlock = (
    <form
      key="email"
      onSubmit={handleSubmit}
      className="px-4 pb-6 max-w-2xl mx-auto w-full"
      style={{ paddingTop: c.padding_email_top }}
    >
      <p className="text-center text-sm font-medium text-foreground mb-3">{c.email_subheading}</p>
      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={c.email_placeholder}
          disabled={busy || previewMode}
          className="h-12 flex-1"
          style={{ fontSize: `${c.body_size}px` }}
        />
        <Button
          type="submit"
          variant="hero"
          size="lg"
          className="h-12 px-6 font-bold shrink-0"
          style={{ fontSize: `${c.body_size}px` }}
          disabled={busy || previewMode}
        >
          {busy ? "Sending..." : c.email_button}
        </Button>
      </div>
      {error && <p className="mt-2 text-sm text-destructive text-center">{error}</p>}
      <p className="mt-2 inline-flex items-center justify-center gap-1.5 w-full text-xs text-muted-foreground">
        <Lock className="h-3 w-3" />
        {c.privacy_text}
      </p>
    </form>
  );

  const blocks: Record<SectionKey, React.ReactElement> = {
    hero: heroBlock,
    video: videoBlock,
    download: downloadBlock,
    email: emailBlock,
  };

  return (
    <div className={embedded ? "bg-background" : "min-h-screen bg-background"}>
      <header className="border-b border-border">
        <div
          className="container mx-auto px-6 flex justify-center"
          style={{ paddingTop: c.padding_header, paddingBottom: c.padding_header }}
        >
          <KrazyLogo className="text-lg" />
        </div>
      </header>

      <main className="w-full max-w-3xl mx-auto pb-16">{order.map((key) => blocks[key])}</main>

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
          <p className="text-[11px] text-muted-foreground truncate">by MYBEATCATALOG</p>
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
