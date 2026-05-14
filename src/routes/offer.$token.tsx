import { createFileRoute, Link } from "@tanstack/react-router";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Check, Clock, Loader2, Music, PlayCircle } from "lucide-react";
import { KrazyLogo } from "@/components/krazy-logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/offer/$token")({
  head: () => ({
    meta: [{ title: "Your Private Beat Offer - MYBEATCATALOG" }],
  }),
  component: BeatOfferPage,
});

type BeatOffer = {
  claim_id: string;
  token: string;
  email: string;
  expires_at: string;
  created_at: string;
  purchased_at: string | null;
  beat_id: string;
  title: string;
  producer_name: string | null;
  genre: string | null;
  mood: string | null;
  music_key: string | null;
  bpm: number | null;
  duration_seconds: number | null;
  cover_url: string | null;
  audio_url: string | null;
  audio_url_tagged: string | null;
};

const FEATURES = [
  "Unlock this beat inside your private membership",
  "Access the full catalog built for artists with a message",
  "Use beats for your songs, releases, and content",
  "Direct line to KrazyJay after joining",
  "Cancel anytime",
];

const OFFER_VIDEO_URL = import.meta.env.VITE_OFFER_VIDEO_URL || "";

function getEmbedUrl(url: string) {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtube.com")) {
      const id = parsed.searchParams.get("v");
      return id ? "https://www.youtube.com/embed/" + id : url;
    }
    if (parsed.hostname === "youtu.be") {
      return "https://www.youtube.com/embed/" + parsed.pathname.replace("/", "");
    }
    if (parsed.hostname.includes("vimeo.com") && /^\/\d+/.test(parsed.pathname)) {
      return "https://player.vimeo.com/video" + parsed.pathname;
    }
    return url;
  } catch {
    return url;
  }
}

function BeatOfferPage() {
  const { token } = Route.useParams();
  const offerQuery = useQuery({
    queryKey: ["beat-offer", token],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_beat_offer", { _token: token });
      if (error) throw error;
      const offer = Array.isArray(data) ? data[0] : data;
      return (offer ?? null) as BeatOffer | null;
    },
  });

  if (offerQuery.isLoading) {
    return <Centered><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></Centered>;
  }

  if (!offerQuery.data) {
    return (
      <Centered>
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-black">This private link was not found.</h1>
          <p className="mt-2 text-muted-foreground">Choose a beat again to create a fresh private offer page.</p>
          <Button className="mt-6" variant="hero" asChild><Link to="/beat-claim">Choose a Beat</Link></Button>
        </div>
      </Centered>
    );
  }

  return <OfferContent offer={offerQuery.data} />;
}

function OfferContent({ offer }: { offer: BeatOffer }) {
  const remaining = useCountdown(offer.expires_at);
  const expired = remaining.total <= 0;
  const checkoutSearch = useMemo(
    () => ({ plan: "artist_monthly_v2", email: offer.email, claim: offer.token }) as any,
    [offer.email, offer.token],
  );
  const meta = [offer.genre, offer.mood, offer.bpm ? String(offer.bpm) + " BPM" : null].filter(Boolean).join(" / ");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/80 bg-background/90 backdrop-blur">
        <div className="container mx-auto flex items-center justify-between px-6 py-5">
          <Link to="/" aria-label="MYBEATCATALOG home"><KrazyLogo className="text-xl" /></Link>
          <Badge variant="secondary" className="border border-primary/30 bg-primary/10 text-primary">PRIVATE OFFER</Badge>
        </div>
      </header>

      <main className="container mx-auto grid gap-8 px-6 py-10 lg:grid-cols-[minmax(0,1fr)_420px] lg:py-14">
        <section className="space-y-6">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-primary">Your beat is reserved</p>
            <h1 className="mt-3 text-4xl font-black leading-tight tracking-tight md:text-6xl">
              {offer.title}
            </h1>
            <p className="mt-4 max-w-2xl text-muted-foreground md:text-lg">
              This is the private page for the beat you selected. Join before the timer ends to unlock this beat plus MYBEATCATALOG membership access.
            </p>
          </div>

          <div className="overflow-hidden rounded-3xl border border-border bg-card">
            <div className="grid gap-0 md:grid-cols-[320px_1fr]">
              <div className="aspect-square bg-muted md:aspect-auto">
                {offer.cover_url ? (
                  <img src={offer.cover_url} alt={offer.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full min-h-[280px] items-center justify-center"><Music className="h-12 w-12 text-muted-foreground" /></div>
                )}
              </div>
              <div className="p-6">
                <div className="flex flex-wrap gap-2">
                  {offer.genre ? <Badge variant="outline">{offer.genre}</Badge> : null}
                  {offer.mood ? <Badge variant="outline">{offer.mood}</Badge> : null}
                  {offer.bpm ? <Badge variant="outline">{offer.bpm} BPM</Badge> : null}
                </div>
                <h2 className="mt-5 text-2xl font-black">Preview the beat</h2>
                <p className="mt-2 text-sm text-muted-foreground">{meta || "Listen again, then lock in your access below."}</p>
                {offer.audio_url_tagged || offer.audio_url ? (
                  <audio controls preload="metadata" src={offer.audio_url_tagged ?? offer.audio_url ?? undefined} className="mt-5 w-full" />
                ) : (
                  <p className="mt-5 text-sm text-muted-foreground">Audio preview is being prepared.</p>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-card p-6 md:p-8">
            <div className="flex items-center gap-3">
              <PlayCircle className="h-8 w-8 text-primary" />
              <div>
                <h2 className="text-2xl font-black">Watch the private offer video</h2>
                <p className="text-sm text-muted-foreground">Add your sales video here when ready.</p>
              </div>
            </div>
            {OFFER_VIDEO_URL ? (
              <iframe
                title="Private offer video"
                src={getEmbedUrl(OFFER_VIDEO_URL)}
                className="mt-6 aspect-video w-full rounded-2xl border border-border bg-black"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            ) : (
              <div className="mt-6 flex aspect-video items-center justify-center rounded-2xl border border-dashed border-primary/40 bg-primary/10 text-center">
                <div className="max-w-sm px-6">
                  <PlayCircle className="mx-auto h-12 w-12 text-primary" />
                  <p className="mt-3 text-sm font-semibold">Private offer video placeholder</p>
                  <p className="mt-1 text-xs text-muted-foreground">Set VITE_OFFER_VIDEO_URL to show your hosted YouTube, Vimeo, or Loom video here.</p>
                </div>
              </div>
            )}
          </div>
        </section>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-3xl border border-primary/60 bg-card p-6 shadow-[var(--shadow-glow)]">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-primary/30 bg-primary/10">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Offer Window</p>
                <h2 className="text-xl font-black">12-hour private access</h2>
              </div>
            </div>

            <Countdown remaining={remaining} />

            <div className="mt-6 space-y-3">
              {FEATURES.map((feature) => (
                <div key={feature} className="flex gap-3 text-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-2xl border border-border bg-background/50 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Reserved for</p>
              <p className="mt-1 truncate font-medium">{offer.email}</p>
            </div>

            <Button variant="hero" size="lg" className="mt-6 w-full" disabled={expired} asChild={!expired}>
              {expired ? (
                <span>Offer Expired</span>
              ) : (
                <Link to="/checkout" search={checkoutSearch}>
                  Unlock This Beat
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              )}
            </Button>
            {expired ? (
              <Button variant="outline" size="lg" className="mt-3 w-full" asChild>
                <Link to="/beat-claim">Choose a New Beat</Link>
              </Button>
            ) : null}
          </div>
        </aside>
      </main>
    </div>
  );
}

function useCountdown(expiresAt: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const total = Math.max(0, new Date(expiresAt).getTime() - now);
  return {
    total,
    hours: Math.floor(total / 3600000),
    minutes: Math.floor((total % 3600000) / 60000),
    seconds: Math.floor((total % 60000) / 1000),
  };
}

function Countdown({ remaining }: { remaining: ReturnType<typeof useCountdown> }) {
  if (remaining.total <= 0) {
    return <p className="mt-6 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-center text-sm text-destructive">This private offer window has expired.</p>;
  }
  return (
    <div className="mt-6">
      <p className="text-center text-xs uppercase tracking-[0.25em] text-muted-foreground">Ends in</p>
      <div className="mt-3 grid grid-cols-3 gap-3">
        <Cell value={remaining.hours} label="hrs" />
        <Cell value={remaining.minutes} label="min" />
        <Cell value={remaining.seconds} label="sec" />
      </div>
    </div>
  );
}

function Cell({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-2xl border border-primary/40 bg-primary/10 p-3 text-center">
      <div className="text-3xl font-black tabular-nums">{String(value).padStart(2, "0")}</div>
      <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
    </div>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">{children}</div>;
}
