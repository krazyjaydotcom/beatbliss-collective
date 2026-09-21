import { useState } from "react";
import { Check, Share2 } from "lucide-react";
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

  return (
    <button
      type="button"
      onClick={() => void share()}
      aria-label={label}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl border border-white/12 px-3 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/60 hover:text-primary",
        className,
      )}
    >
      {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
      {copied ? "Link copied" : label}
    </button>
  );
}
