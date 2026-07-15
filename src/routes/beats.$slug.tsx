import { createFileRoute, notFound } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { HeadphonesIcon, Play, Pause, Volume2, Download, Crown, User, Gift, Instagram, Mail, Phone, X } from "lucide-react";
import {
  getBeatLandingBySlug,
  captureBeatLead,
  checkDiscountEligibility,
  createBeatLeaseCheckoutSession,
} from "@/lib/beat-landing.functions";
import { getStripeEnvironment } from "@/lib/stripe";

const SITE = "https://mybeatcatalog.com";

export const Route = createFileRoute("/beats/$slug")({
  loader: async ({ params }) => {
    const res = await getBeatLandingBySlug({ data: { slug: params.slug } });
    if (!res.beat) throw notFound();
    return res;
  },
  head: ({ loaderData, params }) => {
    const b = loaderData?.beat;
    const url = `${SITE}/beats/${params.slug}`;
    const title = b?.seo_title || (b ? `${b.title} — MYBEATCATALOG` : "Beat — MYBEATCATALOG");
    const desc = b?.seo_description || "Preview the beat, download the tagged version free, purchase a lease, or apply to work direct.";
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:url", content: url },
        { property: "og:type", content: "product" },
        ...(b?.cover_url ? [{ property: "og:image", content: b.cover_url }] : []),
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  notFoundComponent: () => (
    <div className="min-h-screen bg-white flex items-center justify-center text-black">
      <div className="text-center">
        <h1 className="text-2xl font-black">Beat not found</h1>
        <p className="mt-2 text-gray-500">This beat page doesn't exist or has been unpublished.</p>
      </div>
    </div>
  ),
  errorComponent: () => (
    <div className="min-h-screen bg-white flex items-center justify-center text-black">
      <p>Something went wrong. Please refresh.</p>
    </div>
  ),
  component: BeatLandingPage,
});

const OFFER_DURATION_MS = 20 * 60 * 1000;

function useOfferTimer(slug: string) {
  const [remaining, setRemaining] = useState<number>(OFFER_DURATION_MS);
  useEffect(() => {
    const key = `mbc_offer_start_${slug}`;
    let start = Number(localStorage.getItem(key) || 0);
    if (!start) {
      start = Date.now();
      localStorage.setItem(key, String(start));
    }
    const tick = () => {
      const elapsed = Date.now() - start;
      setRemaining(Math.max(0, OFFER_DURATION_MS - elapsed));
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [slug]);
  const active = remaining > 0;
  const min = Math.floor(remaining / 60000);
  const sec = Math.floor((remaining % 60000) / 1000);
  return { active, min, sec };
}

function BeatLandingPage() {
  const { beat, global } = Route.useLoaderData();
  const params = Route.useParams();
  const timer = useOfferTimer(params.slug);

  const [helpOpen, setHelpOpen] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [leaseOpen, setLeaseOpen] = useState(false);

  const videoUrl = beat!.custom_video_url || global?.video_url || null;
  const price = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const showDiscount = timer.active;
  const displayPrice = showDiscount ? beat!.discount_price_cents : beat!.price_cents;

  return (
    <div className="min-h-screen bg-white text-black">
      {/* Header */}
      <header className="mx-auto max-w-5xl px-4 pt-6 sm:pt-8 flex items-start justify-between gap-4">
        <div>
          <div className="text-xl font-black tracking-wide">MYBEATCATALOG</div>
          <div className="text-xs sm:text-sm text-purple-600 font-medium mt-0.5">by KRAZYJAYDOTCOM</div>
        </div>
        <button
          onClick={() => setHelpOpen(true)}
          className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium shadow-sm hover:border-gray-300 transition"
        >
          <HeadphonesIcon className="h-4 w-4" />
          Need Help?
        </button>
      </header>

      <main className="mx-auto max-w-4xl px-4 pt-10 pb-20">
        <h1 className="text-center text-3xl sm:text-5xl font-black tracking-tight leading-tight">
          Find Your Next Record in 60 Seconds.
        </h1>
        <p className="mt-4 text-center text-sm sm:text-base text-gray-500 max-w-2xl mx-auto">
          Preview the beat, download the tagged version free, purchase a lease, or apply to work with me directly.
        </p>

        {/* Discount bar */}
        {showDiscount && (
          <div className="mt-8 rounded-2xl bg-orange-50 border border-orange-100 px-5 py-4 flex items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3">
              <Gift className="h-6 w-6 text-orange-500" />
              <div className="text-sm sm:text-base">
                <span className="font-bold text-orange-600">50% Off</span>{" "}
                <span className="font-semibold">Your First Lease for the Next 20 Minutes</span>
              </div>
            </div>
            <div className="flex items-center gap-1 text-orange-600 font-black tabular-nums">
              <div className="text-center"><div className="text-xl sm:text-2xl leading-none">{String(timer.min).padStart(2, "0")}</div><div className="text-[10px] text-gray-500 mt-0.5">MIN</div></div>
              <div className="text-xl sm:text-2xl">:</div>
              <div className="text-center"><div className="text-xl sm:text-2xl leading-none">{String(timer.sec).padStart(2, "0")}</div><div className="text-[10px] text-gray-500 mt-0.5">SEC</div></div>
            </div>
          </div>
        )}

        {/* Video */}
        <div className="mt-8 rounded-2xl overflow-hidden bg-gray-900 aspect-video shadow-lg">
          {videoUrl ? (
            <video src={videoUrl} controls playsInline className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
              No video yet — upload one in the admin panel.
            </div>
          )}
        </div>

        {/* Audio player */}
        <AudioPlayer beat={beat!} />

        {/* Buttons - desktop L->R: Download, Lease, Apply.  Mobile stack: Lease, Download, Apply */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Lease - mobile order 1, desktop order 2 */}
          <button
            onClick={() => setLeaseOpen(true)}
            className="order-1 md:order-2 group relative rounded-2xl border-2 border-orange-400 bg-orange-50 px-6 py-5 text-left transition hover:shadow-lg hover:-translate-y-0.5"
          >
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-orange-100 flex items-center justify-center">
                <Crown className="h-6 w-6 text-orange-500" />
              </div>
              <div className="flex-1">
                <div className="font-bold text-base">
                  Purchase Lease —{" "}
                  {showDiscount ? (
                    <>
                      <span className="text-orange-600">{price(beat!.discount_price_cents)}</span>{" "}
                      <span className="text-gray-400 line-through text-sm">{price(beat!.price_cents)}</span>
                    </>
                  ) : (
                    <span className="text-orange-600">{price(beat!.price_cents)}</span>
                  )}
                </div>
              </div>
              <div className="text-orange-500">→</div>
            </div>
          </button>

          {/* Download - mobile order 2, desktop order 1 */}
          <button
            onClick={() => setDownloadOpen(true)}
            className="order-2 md:order-1 group rounded-2xl border border-gray-200 bg-white px-6 py-5 text-left transition hover:shadow-md hover:border-purple-200"
          >
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-purple-100 flex items-center justify-center">
                <Download className="h-6 w-6 text-purple-600" />
              </div>
              <div className="flex-1 font-semibold text-sm">Download Tagged Beat</div>
              <div className="text-purple-600">→</div>
            </div>
          </button>

          {/* Apply - always order 3 */}
          <a
            href={beat!.application_url || "#"}
            target={beat!.application_url ? "_blank" : undefined}
            rel="noreferrer"
            className="order-3 group rounded-2xl border border-gray-200 bg-white px-6 py-5 text-left transition hover:shadow-md hover:border-purple-200"
          >
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-purple-100 flex items-center justify-center">
                <User className="h-6 w-6 text-purple-600" />
              </div>
              <div className="flex-1 font-semibold text-sm leading-tight">Apply to Work<br />Direct With Me</div>
              <div className="text-purple-600">→</div>
            </div>
          </a>
        </div>

        <p className="mt-4 text-center text-xs text-gray-400">
          New customers only. Limit one discounted lease per customer.
        </p>

        {beat!.seo_description && (
          <section className="mt-16 border-t border-gray-100 pt-8">
            <p className="text-sm text-gray-500 leading-relaxed max-w-3xl mx-auto">{beat!.seo_description}</p>
          </section>
        )}
      </main>

      {helpOpen && <NeedHelpModal global={global} onClose={() => setHelpOpen(false)} />}
      {downloadOpen && (
        <DownloadModal
          beatId={beat!.id}
          onClose={() => setDownloadOpen(false)}
        />
      )}
      {leaseOpen && (
        <LeaseModal
          beatId={beat!.id}
          fullPriceCents={beat!.price_cents}
          discountPriceCents={beat!.discount_price_cents}
          checkoutUrl={beat!.checkout_url}
          showDiscount={showDiscount}
          onClose={() => setLeaseOpen(false)}
        />
      )}
    </div>
  );
}

function AudioPlayer({ beat }: { beat: NonNullable<ReturnType<typeof Route.useLoaderData>["beat"]> }) {
  const src = beat.audio_url_tagged || beat.audio_url;
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [dur, setDur] = useState(0);
  const [volume, setVolume] = useState(1);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => setPos(a.currentTime);
    const onDur = () => setDur(a.duration || 0);
    const onEnd = () => setPlaying(false);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onDur);
    a.addEventListener("ended", onEnd);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onDur);
      a.removeEventListener("ended", onEnd);
    };
  }, []);

  const toggle = () => {
    const a = audioRef.current;
    if (!a || !src) return;
    if (playing) { a.pause(); setPlaying(false); }
    else { a.play(); setPlaying(true); }
  };

  const fmt = (s: number) => {
    const m = Math.floor(s / 60), sec = Math.floor(s % 60);
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  return (
    <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-4 flex items-center gap-4 shadow-sm">
      <div className="h-14 w-14 rounded-lg overflow-hidden bg-purple-100 flex-shrink-0">
        {beat.cover_url ? (
          <img src={beat.cover_url} alt={beat.title} className="w-full h-full object-cover" />
        ) : null}
      </div>
      <div className="flex-shrink-0 min-w-0">
        <div className="font-bold text-sm truncate">{beat.title}</div>
        <div className="text-xs text-gray-500 truncate">Prod. by {beat.producer_name || "KrazyJay"}</div>
      </div>
      <button
        onClick={toggle}
        className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center hover:bg-purple-200 transition flex-shrink-0"
        aria-label={playing ? "Pause" : "Play"}
      >
        {playing ? <Pause className="h-4 w-4 text-purple-600" /> : <Play className="h-4 w-4 text-purple-600 ml-0.5" />}
      </button>
      <input
        type="range"
        min={0}
        max={dur || 1}
        value={pos}
        onChange={(e) => { if (audioRef.current) audioRef.current.currentTime = Number(e.target.value); }}
        className="flex-1 accent-purple-500 min-w-0"
      />
      <div className="text-xs text-gray-500 tabular-nums flex-shrink-0 hidden sm:block">
        {fmt(pos)} / {fmt(dur)}
      </div>
      <button
        onClick={() => { const v = volume > 0 ? 0 : 1; setVolume(v); if (audioRef.current) audioRef.current.volume = v; }}
        className="text-gray-500 hover:text-gray-700 flex-shrink-0"
        aria-label="Volume"
      >
        <Volume2 className="h-5 w-5" />
      </button>
      {src && <audio ref={audioRef} src={src} preload="metadata" />}
    </div>
  );
}

function NeedHelpModal({ global, onClose }: { global: { contact_instagram: string | null; contact_email: string | null; contact_phone: string | null } | null; onClose: () => void }) {
  const ig = global?.contact_instagram;
  const em = global?.contact_email;
  const ph = global?.contact_phone;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-black">Need Help?</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>
        <div className="mt-4 space-y-2">
          {ig && (
            <a href={ig.startsWith("http") ? ig : `https://instagram.com/${ig.replace(/^@/, "")}`} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-xl border border-gray-200 px-4 py-3 hover:border-purple-300 transition">
              <Instagram className="h-5 w-5 text-purple-600" /><span className="font-medium">Instagram</span>
            </a>
          )}
          {em && (
            <a href={`mailto:${em}`} className="flex items-center gap-3 rounded-xl border border-gray-200 px-4 py-3 hover:border-purple-300 transition">
              <Mail className="h-5 w-5 text-purple-600" /><span className="font-medium">{em}</span>
            </a>
          )}
          {ph && (
            <a href={`tel:${ph}`} className="flex items-center gap-3 rounded-xl border border-gray-200 px-4 py-3 hover:border-purple-300 transition">
              <Phone className="h-5 w-5 text-purple-600" /><span className="font-medium">{ph}</span>
            </a>
          )}
          {!ig && !em && !ph && (
            <p className="text-sm text-gray-500">Contact info not set yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function DownloadModal({ beatId, onClose }: { beatId: string; onClose: () => void }) {
  const capture = useServerFn(captureBeatLead);
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const r = await capture({ data: { beatId, firstName, email } });
      if (r.downloadUrl) setDownloadUrl(r.downloadUrl);
      else setError("Tagged file not available yet.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-black">Free Tagged Download</h3>
          <button onClick={onClose} className="text-gray-400"><X className="h-5 w-5" /></button>
        </div>
        {downloadUrl ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-gray-600">Your download is ready!</p>
            <a href={downloadUrl} download className="block w-full rounded-xl bg-purple-600 text-white text-center px-5 py-3 font-semibold hover:bg-purple-700">
              Download Now
            </a>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-4 space-y-3">
            <input required value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-purple-400" />
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-purple-400" />
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button disabled={loading} className="w-full rounded-xl bg-purple-600 text-white px-5 py-3 font-semibold hover:bg-purple-700 disabled:opacity-50">
              {loading ? "Preparing..." : "Get Free Download"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function LeaseModal({ beatId, fullPriceCents, discountPriceCents, checkoutUrl, showDiscount, onClose }: {
  beatId: string; fullPriceCents: number; discountPriceCents: number; checkoutUrl: string | null; showDiscount: boolean; onClose: () => void;
}) {
  const check = useServerFn(checkDiscountEligibility);
  const record = useServerFn(recordLeaseIntent);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      let useDiscount = showDiscount;
      if (useDiscount) {
        const elig = await check({ data: { email } });
        useDiscount = elig.eligible;
      }
      const r = await record({ data: { beatId, email, useDiscount } });
      if (!r.ok) throw new Error(r.error || "Failed");
      if (r.checkoutUrl) {
        window.location.href = r.checkoutUrl;
      } else {
        setError("Checkout URL not configured. Please contact support.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const price = (c: number) => `$${(c / 100).toFixed(2)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-black">Purchase Lease</h3>
          <button onClick={onClose} className="text-gray-400"><X className="h-5 w-5" /></button>
        </div>
        <div className="mt-3 text-sm text-gray-500">
          {showDiscount ? (
            <>First-time price: <span className="font-bold text-orange-600">{price(discountPriceCents)}</span> (regular {price(fullPriceCents)})</>
          ) : (
            <>Price: <span className="font-bold">{price(fullPriceCents)}</span></>
          )}
        </div>
        <form onSubmit={submit} className="mt-4 space-y-3">
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email for order confirmation" className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-orange-400" />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button disabled={loading || !checkoutUrl} className="w-full rounded-xl bg-orange-500 text-white px-5 py-3 font-semibold hover:bg-orange-600 disabled:opacity-50">
            {loading ? "Processing..." : "Continue to Checkout"}
          </button>
          {!checkoutUrl && <p className="text-xs text-gray-400 text-center">Checkout URL not configured for this beat.</p>}
          <p className="text-[11px] text-gray-400 text-center">New customers only. Limit one discounted lease per customer.</p>
        </form>
      </div>
    </div>
  );
}
