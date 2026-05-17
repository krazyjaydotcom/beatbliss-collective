import { createFileRoute, Link } from "@tanstack/react-router";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { Check, Download, Loader2, Lock, Music, Play, Waves } from "lucide-react";
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
  show_intro_text: boolean;
  show_video_body: boolean;
  show_video_cta: boolean;
  video_cta_text: string;
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
  show_intro_text: true,
  show_video_body: true,
  show_video_cta: true,
  video_cta_text: "See Special Offer",
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

function slugifyFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "") || "beat";
}

function mergeSettings(row: Partial<OfferSettings> | null | undefined): OfferSettings {
  if (!row) return DEFAULT_SETTINGS;
  const merged: OfferSettings = { ...DEFAULT_SETTINGS };
  for (const [key, value] of Object.entries(row)) {
    if (value === null || value === undefined) continue;
    (merged as any)[key] = value;
  }
  merged.benefits = Array.isArray(row.benefits) && row.benefits.length ? row.benefits : DEFAULT_SETTINGS.benefits;
  merged.section_order = Array.isArray(row.section_order) && row.section_order.length ? row.section_order : DEFAULT_SETTINGS.section_order;
  return merged;
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

  useEffect(() => {
    if (!expired || purchased) return;
    window.location.replace("https://mybeatcatalog.com");
  }, [expired, purchased]);
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
        <div className="mx-auto flex max-w-7xl items-center px-5 py-3">
          <Link to="/" aria-label="MYBEATCATALOG home"><KrazyLogo className="text-xl" /></Link>
        </div>
      </header>

      <ElfsightCountdown />

      <main className="mx-auto grid max-w-7xl gap-5 px-5 py-3 lg:grid-cols-[minmax(0,1fr)_420px] lg:py-4">
        <section className="space-y-4">
          <div className="mx-auto max-w-3xl text-center lg:mx-0 lg:max-w-2xl lg:text-left">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-primary">{settings.eyebrow}</p>
            <h1 className="mt-1 text-2xl font-black leading-[1.05] tracking-tight md:text-4xl">
              {headline}
            </h1>
            {settings.show_intro_text && settings.intro_text ? (
              <p className="mx-auto mt-2 max-w-2xl text-xs leading-5 text-white/70 md:text-sm lg:mx-0">{settings.intro_text}</p>
            ) : null}
          </div>

          {orderedSections.map((section) => {
            if (section === "video") return <VideoSection key={section} settings={settings} videoUrl={videoUrl} />;
            if (section === "beat") return <BeatPreview key={section} offer={offer} meta={meta} title={settings.beat_title} />;
            return <Benefits key={section} settings={settings} />;
          })}
        </section>

        <aside id="special-offer" className="scroll-mt-6 lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-2xl border border-primary/40 bg-[#07111d] p-3 shadow-[0_0_60px_rgba(37,99,235,0.18)] sm:p-5">
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

function ElfsightCountdown() {
  useEffect(() => {
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://elfsightcdn.com/platform.js"]');
    if (existing) return;
    const script = document.createElement("script");
    script.src = "https://elfsightcdn.com/platform.js";
    script.async = true;
    document.body.appendChild(script);
  }, []);

  return (
    <section className="border-b border-primary/20 bg-[#02060b] px-5 py-2">
      <div className="mx-auto max-w-7xl">
        <div className="elfsight-app-5dcb9809-b5d4-4238-9c17-29aad78ee380" data-elfsight-app-lazy />
      </div>
    </section>
  );
}

function VideoSection({ settings, videoUrl }: { settings: OfferSettings; videoUrl: string }) {
  function scrollToOffer() {
    document.getElementById("special-offer")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <section className="space-y-3">
      {settings.show_video_body && settings.video_body ? (
        <p className="text-xs text-white/55">{settings.video_body}</p>
      ) : null}
      {videoUrl ? (
        <iframe
          title="Private offer video"
          src={videoUrl}
          className="aspect-video w-full rounded-xl border border-white/10 bg-black shadow-[0_24px_80px_rgba(0,0,0,0.38)]"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      ) : (
        <div className="flex aspect-video items-center justify-center rounded-xl border border-white/10 bg-[radial-gradient(circle_at_center,rgba(37,99,235,0.35),transparent_38%),#03070d] shadow-[0_24px_80px_rgba(0,0,0,0.38)]">
          <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-primary text-primary shadow-[0_0_45px_rgba(37,99,235,0.55)]">
            <Play className="ml-1 h-11 w-11 fill-current" />
          </div>
        </div>
      )}
      {settings.show_video_cta && settings.video_cta_text ? (
        <div className="mt-3 flex justify-center">
          <button
            type="button"
            onClick={scrollToOffer}
            className="rounded-lg bg-primary px-7 py-3 text-sm font-black uppercase tracking-wide text-white shadow-[0_0_35px_rgba(37,99,235,0.32)] transition hover:bg-primary/90"
          >
            {settings.video_cta_text}
          </button>
        </div>
      ) : null}
    </section>
  );
}

function BeatPreview({ offer, meta, title }: { offer: BeatOffer; meta: string; title: string }) {
  const downloadUrl = offer.audio_url_tagged ?? offer.audio_url;
  const downloadName = `MYBEATCATALOG_${slugifyFileName(offer.title)}.mp3`;
  const [downloading, setDownloading] = useState(false);

  async function downloadBeat() {
    if (!downloadUrl || downloading) return;
    setDownloading(true);
    try {
      const response = await fetch(downloadUrl);
      if (!response.ok) throw new Error("Download failed");
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = downloadName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch {
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = downloadName;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      link.remove();
    } finally {
      setDownloading(false);
    }
  }

  return (
    <section className="border-t border-white/10 pt-6">
      <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-primary">
        <Music className="h-4 w-4" /> {title}
      </div>
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
              <div className="mt-4 space-y-3">
                <audio controls preload="metadata" src={downloadUrl ?? undefined} className="w-full" />
                {downloadUrl ? (
                  <button
                    type="button"
                    onClick={downloadBeat}
                    disabled={downloading}
                    className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-5 py-3 text-sm font-black uppercase tracking-wide text-white shadow-[0_0_30px_rgba(37,99,235,0.28)] transition hover:bg-primary/90 sm:w-auto"
                  >
                    {downloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                    {downloading ? "Starting Download" : "Download Beat"}
                  </button>
                ) : null}
              </div>
            ) : (
              <p className="mt-4 text-sm text-white/50">Audio preview is being prepared.</p>
            )}
          </div>
        </div>
    </section>
  );
}

function Benefits({ settings }: { settings: OfferSettings }) {
  return (
    <section className="border-t border-white/10 pt-6">
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {settings.benefits.map((benefit) => (
          <div key={benefit} className="border-l border-primary/40 pl-4">
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
    <div className="stripe-checkout-shell mt-4 min-w-0 overflow-visible rounded-xl bg-transparent sm:mt-5 sm:overflow-hidden sm:border sm:border-white/10 sm:bg-black/40 sm:p-2">
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
