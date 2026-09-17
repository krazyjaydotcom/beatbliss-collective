import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export type AdSpot = {
  id: string;
  title: string;
  media_type: "audio" | "video";
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

function recordEvent(adId: string, event: "impression" | "skip") {
  void supabase.rpc("record_ad_event", { _ad_id: adId, _event: event });
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
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Sponsor message"
      className="fixed inset-0 z-[90] flex flex-col bg-black/95 backdrop-blur"
    >
      <div className="flex items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
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

      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 pb-10 text-center">
        {ad.media_type === "video" ? (
          <video
            ref={mediaRef as React.RefObject<HTMLVideoElement>}
            src={ad.media_url}
            playsInline
            controls
            onEnded={onDone}
            className="max-h-[60vh] w-full max-w-2xl rounded-xl bg-black"
          />
        ) : (
          <>
            {ad.cover_url ? (
              <img
                src={ad.cover_url}
                alt=""
                className="h-48 w-48 rounded-xl object-cover sm:h-60 sm:w-60"
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
