import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { useServerFn } from "@tanstack/react-start";
import { Pause, Play, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createBeatPurchaseCheckout } from "@/lib/payments.functions";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { KrazyLogo } from "@/components/krazy-logo";

type BuyBeat = {
  id: string;
  title: string;
  producer_name: string | null;
  genre: string | null;
  mood: string | null;
  bpm: number | null;
  duration_seconds: number | null;
  cover_url: string | null;
  audio_url: string | null;
  audio_url_tagged: string | null;
  single_sale_price_cents: number | null;
  single_sale_enabled: boolean;
  single_sale_description: string | null;
};

const SITE = "https://mybeatcatalog.com";

export const Route = createFileRoute("/buy/$beatId")({
  loader: async ({ params }) => {
    const { data, error } = await (supabase as any)
      .from("beats")
      .select(
        "id,title,producer_name,genre,mood,bpm,duration_seconds,cover_url,audio_url,audio_url_tagged,single_sale_price_cents,single_sale_enabled,single_sale_description",
      )
      .eq("id", params.beatId)
      .maybeSingle();
    if (error) throw error;
    if (!data || !data.single_sale_enabled) throw notFound();
    return { beat: data as BuyBeat };
  },
  head: ({ loaderData, params }) => {
    const b = loaderData?.beat;
    const url = `${SITE}/buy/${params.beatId}`;
    const title = b ? `Buy '${b.title}' — MYBEATCATALOG` : "Buy Beat — MYBEATCATALOG";
    const desc = b
      ? `Purchase the beat '${b.title}'${b.bpm ? ` (${b.bpm} BPM)` : ""}. Instant access after checkout.`
      : "Purchase a beat from MYBEATCATALOG.";
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:url", content: url },
        { property: "og:type", content: "product" },
        ...(b?.cover_url ? [{ property: "og:image", content: b.cover_url }] : []),
        { name: "robots", content: "noindex" },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  notFoundComponent: () => (
    <div className="min-h-screen flex items-center justify-center bg-[#02060a] text-white px-6 text-center">
      <div>
        <h1 className="text-2xl font-black">Beat not available</h1>
        <p className="mt-2 text-sm text-white/60">This buy link isn't active.</p>
        <Link to="/" className="mt-4 inline-block text-primary underline">Back home</Link>
      </div>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="min-h-screen flex items-center justify-center bg-[#02060a] text-white px-6 text-center">
      <div>
        <h1 className="text-2xl font-black">Something went wrong</h1>
        <p className="mt-2 text-sm text-white/60">{error.message}</p>
      </div>
    </div>
  ),
  component: BuyBeatPage,
});

function formatPrice(cents: number | null | undefined) {
  const n = Number(cents ?? 0);
  return `$${(n / 100).toFixed(2)}`;
}

function BuyBeatPage() {
  const { beat } = Route.useLoaderData();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const previewSrc = beat.audio_url_tagged || beat.audio_url || "";

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onEnd = () => setIsPlaying(false);
    a.addEventListener("ended", onEnd);
    return () => a.removeEventListener("ended", onEnd);
  }, []);

  function togglePlay() {
    const a = audioRef.current;
    if (!a || !previewSrc) return;
    if (isPlaying) {
      a.pause();
      setIsPlaying(false);
    } else {
      a.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    }
  }

  const create = useServerFn(createBeatPurchaseCheckout);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const returnUrl = `${SITE}/checkout/return?session_id={CHECKOUT_SESSION_ID}`;

  const fetchClientSecret = async (): Promise<string> => {
    const result = await create({
      data: { beatId: beat.id, returnUrl, environment: getStripeEnvironment() },
    });
    if (result.error || !result.clientSecret) {
      const msg = result.error ?? "Checkout unavailable.";
      setCheckoutError(msg);
      throw new Error(msg);
    }
    setCheckoutError(null);
    return result.clientSecret;
  };

  const bullets = (beat.single_sale_description ?? "")
    .split("\n")
    .map((l: string) => l.trim())
    .filter(Boolean);


  return (
    <div className="min-h-screen bg-[#02060a] text-white">
      <PaymentTestModeBanner />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(37,99,235,0.18),transparent_38%),linear-gradient(180deg,rgba(2,6,10,0.2),#02060a_72%)]" />
      <div className="relative">
        <header className="border-b border-white/10">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
            <Link to="/" aria-label="MYBEATCATALOG home">
              <KrazyLogo className="text-2xl" />
            </Link>
            <span className="hidden items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-white/70 sm:flex">
              <ShieldCheck className="h-4 w-4 text-primary" /> Secure Checkout
            </span>
          </div>
        </header>

        <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
          <div className="mx-auto max-w-3xl rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 text-center shadow-2xl sm:px-8 sm:py-6">
            <h1 className="text-2xl font-black tracking-tight sm:text-3xl md:text-4xl">
              Beat Name: <span className="text-primary">'{beat.title}'</span>
            </h1>
          </div>

          {previewSrc ? (
            <div className="mx-auto mt-5 max-w-3xl">
              <button
                type="button"
                onClick={togglePlay}
                aria-label={isPlaying ? "Pause preview" : "Play preview"}
                className="group flex w-full items-center gap-3 rounded-full border border-white/15 bg-white/[0.04] px-4 py-3 transition hover:border-primary/60"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-white">
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
                </span>
                <span className="flex-1 text-left text-xs uppercase tracking-wide text-white/60">
                  Hear the Preview here
                </span>
                {beat.bpm ? <span className="text-xs font-semibold text-white/70">{beat.bpm} BPM</span> : null}
              </button>
              <audio ref={audioRef} src={previewSrc} preload="metadata" />
            </div>
          ) : null}

          <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1.1fr] lg:items-start">
            <aside className="space-y-4">
              {beat.cover_url ? (
                <img
                  src={beat.cover_url}
                  alt={beat.title}
                  className="mx-auto aspect-square w-full max-w-sm rounded-xl border border-white/10 object-cover shadow-xl"
                />
              ) : (
                <div className="mx-auto flex aspect-square w-full max-w-sm items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-white/30">
                  No cover
                </div>
              )}
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-5 py-4">
                <h2 className="text-lg font-black">What you get with this beat</h2>
                <ul className="mt-3 space-y-2 text-sm text-white/75">
                  {(bullets.length ? bullets : [
                    "Distribute your track on any platform",
                    "Unlimited plays",
                    "Track-outs available on request",
                    "Instant delivery after payment",
                  ]).map((line: string, i: number) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-primary" />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3 text-sm">
                  <span className="text-white/60">Price</span>
                  <span className="text-xl font-black text-primary">
                    {formatPrice(beat.single_sale_price_cents)}
                  </span>
                </div>
              </div>
            </aside>

            <section className="rounded-2xl border border-white/10 bg-white p-2 text-black shadow-2xl sm:p-3">
              {checkoutError ? (
                <div className="rounded-lg bg-red-50 p-6 text-sm">
                  <p className="font-semibold text-red-700">Checkout unavailable</p>
                  <p className="mt-2 text-red-600">{checkoutError}</p>
                </div>
              ) : (
                <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
                  <EmbeddedCheckout />
                </EmbeddedCheckoutProvider>
              )}
            </section>
          </div>

          <p className="mx-auto mt-8 max-w-2xl text-center text-xs text-white/40">
            Secure payment via Stripe. After purchase you'll receive an email with your download.
          </p>
        </main>
      </div>
    </div>
  );
}
