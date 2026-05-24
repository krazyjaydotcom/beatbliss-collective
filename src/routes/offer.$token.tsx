import { createFileRoute, Link } from "@tanstack/react-router";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { Check, Clock, Download, Loader2, Lock, Music, Pause, Play, Waves } from "lucide-react";
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
  eyebrow: "Private access unlocked",
  headline_template: "{beat} is ready. Stop Hunting For Beats. Build Songs Faster.",
  intro_text:
    "Your free beat is ready below. Before you download it, watch the quick video and grab private catalog access while this intro price is still open.",
  video_title: "Watch the private catalog video",
  video_body:
    "See how private catalog access helps you write, record, and release without hunting through random beat sites.",
  show_intro_text: true,
  show_video_body: true,
  show_video_cta: true,
  video_cta_text: "Start Private Access",
  beat_title: "Download your free beat",
  benefits_title: "Private membership access",
  benefits: [
    "Full private catalog access",
    "Fresh beats added weekly",
    "Use beats for songs, releases, and content",
    "Direct line to KrazyJay after joining",
    "Cancel anytime",
    "Stop hunting random beat sites",
  ],
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
  merged.section_order =
    Array.isArray(row.section_order) && row.section_order.length ? row.section_order : DEFAULT_SETTINGS.section_order;
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
    return (
      <Centered>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </Centered>
    );
  }

  if (!offerQuery.data) {
    return (
      <Centered>
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-black">This private link was not found.</h1>
          <p className="mt-2 text-muted-foreground">Choose a beat again to create a fresh private offer page.</p>
          <Link
            to="/beat-claim"
            className="mt-6 inline-flex rounded-lg bg-primary px-5 py-3 text-sm font-bold text-primary-foreground"
          >
            Choose a Beat
          </Link>
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
          <Link to="/" aria-label="MYBEATCATALOG home">
            <KrazyLogo className="text-xl" />
          </Link>
        </div>
      </header>

      <main className="offer-cinematic-enter mx-auto grid max-w-7xl gap-7 px-5 py-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:py-7">
        <section className="space-y-5">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-black uppercase tracking-[0.42em] text-primary">Your beat is ready</p>
            <h1 className="mt-3 text-4xl font-black leading-[1.03] tracking-tight md:text-6xl">
              <span className="block text-primary">{offer.title} is ready.</span>
              Stop Hunting For Beats. Build Songs Faster.
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-white/70 md:text-base">
              Your free beat is ready below. Before you download it, see how private catalog access helps you write,
              record, and release without hunting through random beat sites.
            </p>
          </div>

          {orderedSections.map((section) => {
            if (section === "video") {
              return (
                <div key={section} className="space-y-5">
                  <VideoSection settings={settings} videoUrl={videoUrl} />
                  <OfferCountdown remaining={remaining} />
                </div>
              );
            }
            if (section === "beat")
              return <BeatPreview key={section} offer={offer} meta={meta} title={settings.beat_title} />;
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
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/55">
                  Private Beat Catalog Access
                </p>
                <h2 className="text-2xl font-black">
                  $49.99<span className="ml-1 text-sm font-semibold text-white/60">/mo</span>
                </h2>
                <p className="mt-1 max-w-xs text-xs leading-5 text-white/55">
                  For artists who want fresh beats every week without hunting through random marketplaces.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-2">
              {[
                "Full private catalog access",
                "Fresh beats added weekly",
                "Use beats for songs, releases, and content",
                "Direct line to KrazyJay after joining",
                "Cancel anytime",
                "No more scrolling random beat sites looking for the right sound",
              ].map((item) => (
                <div key={item} className="flex gap-2 text-sm text-white/75">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>{item}</span>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() =>
                document
                  .querySelector(".stripe-checkout-shell")
                  ?.scrollIntoView({ behavior: "smooth", block: "center" })
              }
              className="mt-5 w-full rounded-xl bg-primary px-5 py-4 text-sm font-black uppercase tracking-wide text-white shadow-[0_0_32px_rgba(37,99,235,0.28)] transition hover:bg-primary/90"
            >
              Start Private Access
            </button>
            <div className="mt-3 space-y-1 text-center text-xs leading-5 text-white/55">
              <p>Unlocks instantly. Cancel anytime.</p>
              <p className="inline-flex items-center justify-center gap-1.5 font-semibold text-white/70">
                <Lock className="h-3.5 w-3.5 text-primary" />
                Secure checkout powered by Stripe
              </p>
              <p>After joining, you can access the full catalog and start downloading beats today.</p>
            </div>

            <div className="mt-5 rounded-xl border border-white/10 bg-black/30 p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/45">Reserved for</p>
              <p className="mt-1 truncate text-sm font-semibold">{offer.email}</p>
            </div>

            {purchased ? (
              <ClosedBox
                title="Offer already used"
                message="This private offer has already been used for a purchase."
              />
            ) : expired ? (
              <ClosedBox
                title="Offer expired"
                message="This private checkout window is closed. The same email, device, or IP cannot restart this offer automatically."
              />
            ) : (
              <OfferEmbeddedCheckout offer={offer} />
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}

function OfferCountdown({ remaining }: { remaining: ReturnType<typeof useCountdown> }) {
  const expired = remaining.total <= 0;
  return (
    <section className="mx-auto w-full max-w-4xl rounded-2xl border border-primary/35 bg-black/20 px-4 py-5 text-center shadow-[0_0_45px_rgba(37,99,235,0.12)] sm:px-8">
      <div className="flex items-center justify-center gap-3 text-xs font-black uppercase tracking-[0.18em] text-white/85">
        <span className="hidden h-px w-20 bg-white/25 sm:block" />
        <Clock className="h-5 w-5 text-primary" />
        <span>{expired ? "Private Access Expired" : "Private Access Expires In"}</span>
        <span className="hidden h-px w-20 bg-white/25 sm:block" />
      </div>

      <div className="mt-5 grid grid-cols-[1fr_auto_1fr_auto_1fr] items-start gap-2 sm:gap-4">
        <CountdownUnit value={remaining.hours} label="Hours" />
        <span className="pt-1 text-4xl font-black text-white/80 sm:text-6xl">:</span>
        <CountdownUnit value={remaining.minutes} label="Minutes" />
        <span className="pt-1 text-4xl font-black text-white/80 sm:text-6xl">:</span>
        <CountdownUnit value={remaining.seconds} label="Seconds" />
      </div>

      <div className="mt-5 flex items-center justify-center gap-4 text-white/50">
        <span className="h-px flex-1 bg-white/20" />
        <Lock className="h-4 w-4" />
        <span className="h-px flex-1 bg-white/20" />
      </div>
      <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-white/70">
        This private intro price is only available from this beat-claim page. Once the timer hits zero, this offer
        closes.
      </p>
    </section>
  );
}

function CountdownUnit({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <div className="text-5xl font-black leading-none tabular-nums text-white sm:text-7xl">
        {String(value).padStart(2, "0")}
      </div>
      <div className="mt-2 text-[10px] font-bold uppercase tracking-[0.12em] text-white/70 sm:text-xs">{label}</div>
    </div>
  );
}

function VideoSection({ settings, videoUrl }: { settings: OfferSettings; videoUrl: string }) {
  function scrollToOffer() {
    document.getElementById("special-offer")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <section className="space-y-4">
      <div className="sr-only">
        <Lock className="h-5 w-5 text-primary" />
        <div>
          <h2>{settings.video_title}</h2>
          {settings.show_video_body && settings.video_body ? <p>{settings.video_body}</p> : null}
        </div>
      </div>
      {videoUrl ? (
        <iframe
          title="Private offer video"
          src={videoUrl}
          className="aspect-video w-full rounded-[1.35rem] border border-white/15 bg-black shadow-[0_24px_80px_rgba(0,0,0,0.48)]"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      ) : (
        <div className="flex aspect-video items-center justify-center rounded-[1.35rem] border border-white/15 bg-[radial-gradient(circle_at_center,rgba(37,99,235,0.35),transparent_38%),#03070d] shadow-[0_24px_80px_rgba(0,0,0,0.48)]">
          <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-primary text-primary shadow-[0_0_45px_rgba(37,99,235,0.55)]">
            <Play className="ml-1 h-11 w-11 fill-current" />
          </div>
        </div>
      )}
      {settings.show_video_cta && settings.video_cta_text ? (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={scrollToOffer}
            className="w-full max-w-md rounded-xl bg-primary px-7 py-4 text-sm font-black uppercase tracking-wide text-white shadow-[0_0_35px_rgba(37,99,235,0.32)] transition hover:bg-primary/90 sm:text-base"
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
  const downloadHref = `/api/public/download-beat?token=${encodeURIComponent(offer.token)}`;
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onEnded = () => setPlaying(false);
    audio.addEventListener("ended", onEnded);
    return () => audio.removeEventListener("ended", onEnded);
  }, []);

  async function togglePlay() {
    const audio = audioRef.current;
    if (!audio || !downloadUrl) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
      return;
    }
    try {
      await audio.play();
      setPlaying(true);
    } catch {
      setPlaying(false);
    }
  }

  return (
    <section className="border-t border-white/10 pt-6">
      <div className="mb-5 flex items-center justify-center gap-4 text-center text-xs font-bold uppercase tracking-[0.32em] text-white">
        <span className="h-px flex-1 bg-white/15" />
        <span className="inline-flex items-center gap-2">
          <Music className="h-5 w-5 text-primary" /> {title}
        </span>
        <span className="h-px flex-1 bg-white/15" />
      </div>
      <div className="mx-auto max-w-3xl">
        <button
          type="button"
          onClick={togglePlay}
          disabled={!downloadUrl}
          className="group relative block aspect-[16/9] w-full overflow-hidden rounded-xl border border-white/15 bg-black/40 text-left shadow-[0_24px_80px_rgba(0,0,0,0.45)]"
          aria-label={(playing ? "Pause " : "Play ") + offer.title}
        >
          {offer.cover_url ? (
            <img src={offer.cover_url} alt={offer.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_center,rgba(37,99,235,0.45),transparent_58%)] p-8 text-center text-3xl font-black">
              {offer.title}
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-white/95 text-primary shadow-[0_0_45px_rgba(37,99,235,0.45)] transition group-hover:scale-105">
              {playing ? <Pause className="h-9 w-9" /> : <Play className="ml-1 h-10 w-10 fill-current" />}
            </span>
          </div>
          <div className="absolute bottom-4 left-4 right-4">
            <div className="flex flex-wrap gap-2">
              {offer.genre ? (
                <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
                  {offer.genre}
                </Badge>
              ) : null}
              {offer.bpm ? (
                <Badge variant="outline" className="border-white/20 text-white/70">
                  {offer.bpm} BPM
                </Badge>
              ) : null}
            </div>
            <h2 className="mt-3 text-2xl font-black">{offer.title}</h2>
            <p className="mt-1 text-sm text-white/70">{meta || "Tap the cover to preview this beat."}</p>
          </div>
        </button>
        {downloadUrl ? (
          <>
            <audio ref={audioRef} preload="metadata" src={downloadUrl} />
            <div className="mt-4 flex flex-col items-center gap-3">
              <a
                href={downloadHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full max-w-md items-center justify-center rounded-xl bg-primary px-5 py-4 text-sm font-black uppercase tracking-wide text-white shadow-[0_0_30px_rgba(37,99,235,0.28)] transition hover:bg-primary/90"
              >
                <Download className="mr-2 h-4 w-4" />
                Download Beat
              </a>
              <p className="max-w-md text-center text-xs leading-5 text-white/55">
                If Instagram has trouble downloading, tap the three dots and open this page in your browser.
              </p>
            </div>
          </>
        ) : (
          <p className="mt-4 text-center text-sm text-white/50">Audio preview is being prepared.</p>
        )}
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
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">{children}</div>
  );
}
