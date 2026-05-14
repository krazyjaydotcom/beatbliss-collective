import { createFileRoute, Link } from "@tanstack/react-router";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { Check, Clock, Loader2, Lock, Music, Play, ShieldCheck, Waves } from "lucide-react";
import { KrazyLogo } from "@/components/krazy-logo";
import { Badge } from "@/components/ui/badge";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { supabase } from "@/integrations/supabase/client";
import { createGuestCheckoutSession } from "@/lib/payments.functions";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";

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

type OfferSettings = {
  id: string;
  video_url: string | null;
  eyebrow: string;
  headline_template: string;
  intro_text: string;
  video_title: string;
  video_body: string;
  beat_title: string;
  benefits_title: string;
  benefits: string[];
  section_order: string[];
};

const DEFAULT_SETTINGS: OfferSettings = {
  id: "main",
  video_url: import.meta.env.VITE_OFFER_VIDEO_URL || "",
  eyebrow: "Your beat is reserved",
  headline_template: "{beat} is Reserved For You",
  intro_text: "This is a private offer. Watch the video below to see everything you get with your membership before the timer expires.",
  video_title: "Watch the private offer video",
  video_body: "A quick breakdown of how MYBEATCATALOG helps artists create, release, and stay consistent.",
  beat_title: "Preview the beat",
  benefits_title: "Membership includes",
  benefits: ["Full Beat Catalog", "New Beats Weekly", "Direct Artist Access", "Cancel Anytime"],
  section_order: ["video", "beat", "benefits"],
};

function formatDuration(seconds: number | null | undefined) {
  const total = Math.max(0, Number(seconds ?? 0));
  if (!total) return "--:--";
  const min = Math.floor(total / 60);
  const sec = Math.floor(total % 60);
  return String(min).padStart(2, "0") + ":" + String(sec).padStart(2, "0");
}

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

function mergeSettings(row: Partial<OfferSettings> | null | undefined): OfferSettings {
  if (!row) return DEFAULT_SETTINGS;
  return {
    ...DEFAULT_SETTINGS,
    ...row,
    benefits: Array.isArray(row.benefits) ? row.benefits : DEFAULT_SETTINGS.benefits,
    section_order: Array.isArray(row.section_order) && row.section_order.length ? row.section_order : DEFAULT_SETTINGS.section_order,
  };
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
  const settingsQuery = useQuery({
    queryKey: ["offer-page-settings"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("offer_page_settings")
        .select("*")
        .eq("id", "main")
        .maybeSingle();
      if (error) return DEFAULT_SETTINGS;
      return mergeSettings(data as Partial<OfferSettings> | null);
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
          <Link to="/beat-claim" className="mt-6 inline-flex rounded-lg bg-primary px-5 py-3 text-sm font-bold text-primary-foreground">Choose a Beat</Link>
        </div>
      </Centered>
    );
  }

  return <OfferContent offer={offerQuery.data} settings={settingsQuery.data ?? DEFAULT_SETTINGS} />;
}

function OfferContent({ offer, settings }: { offer: BeatOffer; settings: OfferSettings }) {
  const remaining = useCountdown(offer.expires_at);
  const expired = remaining.total <= 0;
  const purchased = !!offer.purchased_at;
  const headline = settings.headline_template.replace("{beat}", offer.title);
  const meta = [offer.genre, offer.mood, offer.bpm ? String(offer.bpm) + " BPM" : null].filter(Boolean).join(" / ");
  const videoUrl = getEmbedUrl(settings.video_url || "");
  const orderedSections = useMemo(() => {
    const valid = settings.section_order.filter((id) => ["video", "beat", "benefits"].includes(id));
    return valid.length ? valid : DEFAULT_SETTINGS.section_order;
  }, [settings.section_order]);

  return (
    <div className="min-h-screen bg-[#02060b] text-white">
      <PaymentTestModeBanner />
      <header className="border-b border-white/10 bg-black/70 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5">
          <Link to="/" aria-label="MYBEATCATALOG home"><KrazyLogo className="text-xl" /></Link>
          <Badge variant="outline" className="border-primary/50 bg-primary/10 text-primary"><Lock className="mr-1.5 h-3.5 w-3.5" /> Private Offer</Badge>
        </div>
      </header>

      <TopTimer remaining={remaining} />

      <main className="mx-auto grid max-w-7xl gap-8 px-5 py-8 lg:grid-cols-[minmax(0,1fr)_420px] lg:py-10">
        <section className="space-y-6">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.22em] text-primary">{settings.eyebrow}</p>
            <h1 className="mt-3 max-w-2xl text-4xl font-black leading-[1.03] tracking-tight md:text-6xl">
              {headline}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-white/70 md:text-base">{settings.intro_text}</p>
          </div>

          {orderedSections.map((section) => {
            if (section === "video") return <VideoSection key={section} settings={settings} videoUrl={videoUrl} />;
            if (section === "beat") return <BeatPreview key={section} offer={offer} meta={meta} />;
            return <Benefits key={section} settings={settings} />;
          })}
        </section>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-2xl border border-primary/40 bg-[#07111d] p-5 shadow-[0_0_60px_rgba(37,99,235,0.18)]">
            <div className="flex items-center gap-3 border-b border-white/10 pb-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-full border border-primary/50 bg-primary/10">
                <Lock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/55">Special Offer</p>
                <h2 className="text-2xl font-black">$49.99<span className="ml-1 text-sm font-semibold text-white/60">/mo</span></h2>
              </div>
            </div>

            <div className="mt-5 space-y-2">
              {["Unlock full catalog access", "New beats added every week", "Use beats for songs, releases, and content", "Direct line to KrazyJay after joining", "Cancel anytime"].map((item) => (
                <div key={item} className="flex gap-2 text-sm text-white/75">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>{item}</span>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-xl border border-white/10 bg-black/30 p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/45">Reserved for</p>
              <p className="mt-1 truncate text-sm font-semibold">{offer.email}</p>
            </div>

            {purchased ? (
              <ClosedBox title="Offer already used" message="This private offer has already been used for a purchase." />
            ) : expired ? (
              <ClosedBox title="Offer expired" message="This private checkout window is closed. The same email, device, or IP cannot restart this offer automatically." />
            ) : (
              <OfferEmbeddedCheckout offer={offer} />
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}

function TopTimer({ remaining }: { remaining: ReturnType<typeof useCountdown> }) {
  const expired = remaining.total <= 0;
  return (
    <section className="border-b border-primary/30 bg-[#041121]">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Clock className="h-5 w-5 text-primary" />
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-primary">12-hour private access</p>
            <p className="text-sm text-white/60">{expired ? "This private offer window has expired." : "Offer expires in"}</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <TimerCell value={remaining.hours} label="hrs" />
          <TimerCell value={remaining.minutes} label="min" />
          <TimerCell value={remaining.seconds} label="sec" />
        </div>
      </div>
    </section>
  );
}

function TimerCell({ value, label }: { value: number; label: string }) {
  return (
    <div className="min-w-[78px] rounded-lg border border-white/10 bg-black/35 px-4 py-2 text-center">
      <div className="text-2xl font-black tabular-nums">{String(value).padStart(2, "0")}</div>
      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/50">{label}</div>
    </div>
  );
}

function VideoSection({ settings, videoUrl }: { settings: OfferSettings; videoUrl: string }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-[#07111d] p-5">
      <div className="mb-4 flex items-center gap-3">
        <Lock className="h-5 w-5 text-primary" />
        <div>
          <h2 className="text-sm font-black uppercase tracking-[0.12em]">{settings.video_title}</h2>
          <p className="mt-1 text-xs text-white/55">{settings.video_body}</p>
        </div>
      </div>
      {videoUrl ? (
        <iframe
          title="Private offer video"
          src={videoUrl}
          className="aspect-video w-full rounded-xl border border-white/10 bg-black"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      ) : (
        <div className="flex aspect-video items-center justify-center rounded-xl border border-white/10 bg-[radial-gradient(circle_at_center,rgba(37,99,235,0.35),transparent_38%),#03070d]">
          <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-primary text-primary shadow-[0_0_45px_rgba(37,99,235,0.55)]">
            <Play className="ml-1 h-11 w-11 fill-current" />
          </div>
        </div>
      )}
    </section>
  );
}

function BeatPreview({ offer, meta }: { offer: BeatOffer; meta: string }) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-primary">
        <Music className="h-4 w-4" /> Preview the beat
      </div>
      <div className="rounded-2xl border border-white/10 bg-[#07111d] p-4">
        <div className="grid gap-4 md:grid-cols-[130px_1fr] md:items-center">
          <div className="aspect-square overflow-hidden rounded-xl border border-white/10 bg-black/40">
            {offer.cover_url ? (
              <img src={offer.cover_url} alt={offer.title} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_center,rgba(37,99,235,0.45),transparent_58%)] text-center text-xl font-black">
                {offer.title}
              </div>
            )}
          </div>
          <div>
            <div className="flex flex-wrap gap-2">
              {offer.genre ? <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">{offer.genre}</Badge> : null}
              {offer.bpm ? <Badge variant="outline" className="border-white/20 text-white/70">{offer.bpm} BPM</Badge> : null}
            </div>
            <h2 className="mt-3 text-2xl font-black">{offer.title}</h2>
            <p className="mt-1 text-sm text-white/55">{meta || "Listen again, then lock in your access."}</p>
            {offer.audio_url_tagged || offer.audio_url ? (
              <audio controls preload="metadata" src={offer.audio_url_tagged ?? offer.audio_url ?? undefined} className="mt-4 w-full" />
            ) : (
              <p className="mt-4 text-sm text-white/50">Audio preview is being prepared.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function Benefits({ settings }: { settings: OfferSettings }) {
  return (
    <section>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {settings.benefits.map((benefit) => (
          <div key={benefit} className="rounded-xl border border-white/10 bg-[#07111d] p-4">
            <Waves className="h-5 w-5 text-primary" />
            <h3 className="mt-3 text-sm font-black">{benefit}</h3>
            <p className="mt-2 text-xs leading-5 text-white/55">{settings.benefits_title}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function OfferEmbeddedCheckout({ offer }: { offer: BeatOffer }) {
  const create = useServerFn(createGuestCheckoutSession);
  const [error, setError] = useState<string | null>(null);

  const fetchClientSecret = async (): Promise<string> => {
    const returnUrl = `${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`;
    const result = await create({
      data: {
        priceId: "artist_monthly_v2",
        email: offer.email,
        returnUrl,
        environment: getStripeEnvironment(),
        claimToken: offer.token,
      },
    });
    if (result.error || !result.clientSecret) {
      const msg = result.error ?? "Failed to create checkout session";
      setError(msg);
      throw new Error(msg);
    }
    setError(null);
    return result.clientSecret;
  };

  if (error) {
    return (
      <div className="mt-5 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm">
        <p className="font-semibold text-red-200">Checkout unavailable</p>
        <p className="mt-2 text-white/60">{error}</p>
      </div>
    );
  }

  return (
    <div className="mt-5 overflow-hidden rounded-xl border border-white/10 bg-black/40 p-2">
      <div className="mb-3 flex items-center gap-2 px-2 pt-2 text-xs text-white/55">
        <ShieldCheck className="h-4 w-4 text-primary" /> Secure embedded checkout
      </div>
      <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}

function ClosedBox({ title, message }: { title: string; message: string }) {
  return (
    <div className="mt-5 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
      <p className="font-semibold text-amber-200">{title}</p>
      <p className="mt-2 text-white/60">{message}</p>
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

function Centered({ children }: { children: ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">{children}</div>;
}