import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export type AdSpot = {
  id: string;
  title: string;
  media_type: "audio" | "video" | "embed";
  media_url: string;
  cover_url: string | null;
  cta_label: string | null;
  cta_url: string | null;
};

const ROTATION_KEY = "mbc.ad.rotation";

export async function fetchActiveAds(): Promise<AdSpot[]> {
  const { data, error } = await supabase
    .from("ad_spots")
    .select("id,title,media_type,media_url,cover_url,cta_label,cta_url")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error || !data) return [];
  return data as AdSpot[];
}

/** Rotates through the active spots in the order the admin set, per browser. */
export function pickNextAd(ads: AdSpot[]): AdSpot | null {
  if (!ads.length) return null;
  let idx = 0;
  try {
    idx = Number(localStorage.getItem(ROTATION_KEY) ?? "0") || 0;
    localStorage.setItem(ROTATION_KEY, String((idx + 1) % ads.length));
  } catch {
    /* storage unavailable — always show the first spot */
  }
  return ads[idx % ads.length] ?? null;
}

function recordEvent(adId: string, event: "impression" | "skip" | "click") {
  void supabase.rpc("record_ad_event", { _ad_id: adId, _event: event });
}

/**
 * Turns a YouTube / Vimeo watch link into an embeddable player URL.
 * Anything else is passed through untouched.
 */
export function toEmbedUrl(raw: string): string {
  const url = raw.trim();
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      return `https://www.youtube.com/embed/${u.pathname.slice(1)}?autoplay=1&rel=0`;
    }
    if (host.endsWith("youtube.com")) {
      if (u.pathname.startsWith("/embed/")) return url;
      const v = u.searchParams.get("v");
      if (v) return `https://www.youtube.com/embed/${v}?autoplay=1&rel=0`;
      if (u.pathname.startsWith("/shorts/")) {
        return `https://www.youtube.com/embed/${u.pathname.split("/")[2]}?autoplay=1&rel=0`;
      }
    }
    if (host.endsWith("vimeo.com")) {
      if (host.startsWith("player.")) return url;
      const id = u.pathname.split("/").filter(Boolean)[0];
      if (id) return `https://player.vimeo.com/video/${id}?autoplay=1`;
    }
  } catch {
    /* not a parseable URL — show it as-is */
  }
  return url;
}

export function AdOverlay({ ad, onDone }: { ad: AdSpot; onDone: () => void }) {
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);
  const [skipped, setSkipped] = useState(false);

  useEffect(() => {
    recordEvent(ad.id, "impression");
    const el = mediaRef.current;
    if (el) void el.play().catch(() => undefined);
  }, [ad.id]);

  const skip = () => {
    if (!skipped) {
      setSkipped(true);
      recordEvent(ad.id, "skip");
    }
    onDone();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") skip();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    // Stops above the player bar (and the mobile bottom nav) so listeners can
    // always see they are still inside the store.
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Sponsor message"
      className="fixed inset-x-0 top-0 bottom-[9.75rem] z-[90] flex flex-col overflow-y-auto bg-black/92 backdrop-blur lg:bottom-[6.25rem]"
    >
      <div className="flex items-center justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6">
        <span className="rounded-full border border-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Sponsor message
        </span>
        <button
          type="button"
          onClick={skip}
          autoFocus
          className="flex h-11 items-center gap-1.5 rounded-full border border-white/15 px-4 text-sm font-medium text-foreground hover:border-primary/60 hover:text-primary"
        >
          Skip <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-5 py-6 text-center">
        {ad.media_type === "embed" ? (
          <div className="aspect-video w-full max-w-2xl overflow-hidden rounded-xl bg-black">
            <iframe
              src={toEmbedUrl(ad.media_url)}
              title={ad.title}
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
              className="h-full w-full border-0"
            />
          </div>
        ) : ad.media_type === "video" ? (
          <video
            ref={mediaRef as React.RefObject<HTMLVideoElement>}
            src={ad.media_url}
            playsInline
            controls
            onEnded={onDone}
            className="max-h-[46vh] w-full max-w-2xl rounded-xl bg-black"
          />
        ) : (
          <>
            {ad.cover_url ? (
              <img
                src={ad.cover_url}
                alt=""
                className="h-36 w-36 rounded-xl object-cover sm:h-48 sm:w-48"
              />
            ) : null}
            <audio
              ref={mediaRef as React.RefObject<HTMLAudioElement>}
              src={ad.media_url}
              controls
              onEnded={onDone}
              className="w-full max-w-md"
            />
          </>
        )}

        <h2 className="text-lg font-semibold tracking-tight">{ad.title}</h2>

        <div className="flex flex-wrap items-center justify-center gap-3">
          {ad.cta_url ? (
            <a
              href={ad.cta_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => recordEvent(ad.id, "click")}
              className="flex h-11 items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground"
            >
              {ad.cta_label || "Learn more"}
            </a>
          ) : null}
          <Link
            to="/signup"
            onClick={skip}
            className="flex h-11 items-center rounded-full border border-white/15 px-5 text-sm font-medium hover:border-primary/60 hover:text-primary"
          >
            Sign up free — no ads
          </Link>
        </div>
        <p className="text-xs text-muted-foreground">
          Free listening is supported by short messages. Members never hear them.
        </p>
      </div>
    </div>
  );
}
