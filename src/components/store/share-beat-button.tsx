import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Copy, Instagram, Share2, Youtube, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Builds the public share link for a beat. The link opens the store player with
 * that beat selected and asks it to start playing as soon as the page loads.
 */
export function beatShareUrl(ref: string, origin?: string): string {
  const base =
    origin ?? (typeof window !== "undefined" ? window.location.origin : "https://mybeatcatalog.com");
  return `${base}/?beat=${encodeURIComponent(ref)}&play=1`;
}

export function beatYouTubeUrl(ref: string, shortId?: string): string {
  const url = new URL(`/yt/${encodeURIComponent(ref)}`, "https://mybeatcatalog.com");
  if (shortId?.trim()) url.searchParams.set("s", shortId.trim().slice(0, 160));
  return url.toString();
}

export function beatInstagramUrl(ref: string, postId?: string): string {
  const url = new URL(`/ig/${encodeURIComponent(ref)}`, "https://mybeatcatalog.com");
  if (postId?.trim()) url.searchParams.set("s", postId.trim().slice(0, 160));
  return url.toString();
}

/** Email-capture page that hands over the tagged MP3 and offers the licenses. */
export function beatFreeDownloadUrl(ref: string): string {
  return `https://mybeatcatalog.com/free/${encodeURIComponent(ref)}`;
}

export function ShareBeatButton({
  beatRef,
  title,
  className,
  label = "Share beat",
}: {
  beatRef: string;
  title: string;
  className?: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);
  const [more, setMore] = useState(false);
  const [shortId, setShortId] = useState("");
  const [copiedKind, setCopiedKind] = useState<"youtube" | "instagram" | "free" | "cta" | null>(
    null,
  );
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);

  const share = async () => {
    const url = beatShareUrl(beatRef);
    const nav = typeof navigator !== "undefined" ? navigator : undefined;
    if (nav?.share) {
      try {
        await nav.share({ title, text: `Listen to “${title}”`, url });
        return;
      } catch {
        /* user dismissed the share sheet — fall through to copying */
      }
    }
    try {
      await nav?.clipboard?.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link", url);
    }
  };

  const copy = async (value: string, kind: "youtube" | "instagram" | "free" | "cta") => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      window.prompt("Copy this", value);
    }
    setCopiedKind(kind);
    setTimeout(() => setCopiedKind(null), 2000);
  };

  const cta = `License ${title} — visit the link on my channel profile.`;

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={label}
        aria-expanded={open}
        className={cn(
          "inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/12 px-3 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/60 hover:text-primary",
          className,
        )}
      >
        <Share2 className="h-4 w-4" /> <span className="hidden min-[380px]:inline">Share</span>
      </button>
      {open ? (
        <div className="fixed inset-x-3 top-[max(.75rem,env(safe-area-inset-top))] z-[110] max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-2xl border border-white/12 bg-card p-4 shadow-2xl sm:absolute sm:inset-auto sm:right-0 sm:top-12 sm:w-[340px]">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Share this beat</p>
            <button type="button" onClick={() => setOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-full" aria-label="Close sharing"><X className="h-4 w-4" /></button>
          </div>
          <button type="button" onClick={() => void share()} className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/12 text-sm font-medium">
            {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />} {copied ? "Link copied" : "Share normally"}
          </button>
          <button type="button" onClick={() => void copy(beatYouTubeUrl(beatRef, shortId), "youtube")} className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground">
            {copiedKind === "youtube" ? <Check className="h-4 w-4" /> : <Youtube className="h-4 w-4" />} {copiedKind === "youtube" ? "YouTube link copied" : "Copy YouTube link"}
          </button>
          <button type="button" onClick={() => void copy(beatInstagramUrl(beatRef, shortId), "instagram")} className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-primary/50 text-sm font-semibold text-primary">
            {copiedKind === "instagram" ? <Check className="h-4 w-4" /> : <Instagram className="h-4 w-4" />} {copiedKind === "instagram" ? "Instagram link copied" : "Copy Instagram link"}
          </button>
          <button type="button" onClick={() => setMore((v) => !v)} className="mt-2 flex h-9 items-center gap-1 text-xs text-muted-foreground underline underline-offset-4" aria-expanded={more}>
            Optional post, Reel, or Short ID <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", more && "rotate-180")} />
          </button>
          {more ? <input value={shortId} onChange={(e) => setShortId(e.target.value)} maxLength={160} placeholder="Content ID (optional)" className="h-10 w-full rounded-lg border border-white/12 bg-background px-3 text-sm outline-none focus:border-primary/60" /> : null}
          <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <p className="text-xs leading-relaxed text-muted-foreground">{cta}</p>
            <button type="button" onClick={() => void copy(cta, "cta")} className="mt-2 inline-flex h-9 items-center gap-2 text-xs font-semibold text-primary">
              {copiedKind === "cta" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copiedKind === "cta" ? "CTA copied" : "Copy CTA text"}
            </button>
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">On YouTube, ordinary Shorts description and comment links are not clickable. On Instagram, use your profile link or a Story link sticker.</p>
        </div>
      ) : null}
    </div>
  );
}
