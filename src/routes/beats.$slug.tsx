import { createFileRoute, notFound } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { HeadphonesIcon, Play, Pause, Volume2, Download, Crown, Gift, Instagram, Mail, Phone, X, ShoppingBag, FileText, Sparkles, CalendarClock } from "lucide-react";
import {
  getBeatLandingBySlug,
  captureBeatLead,
  checkDiscountEligibility,
  createBeatLeaseCheckoutSession,
  listInquiryQuestions,
  submitBeatInquiry,
  type BeatAttachment,
  type InquiryQuestion,
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
    const desc = b?.seo_description || "Preview the beat, download the tagged version free, purchase the unlimited license, or apply to work direct.";
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

function formatPostedAt(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (!isFinite(then)) return null;
  const diff = Date.now() - then;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "Posted just now";
  if (mins < 60) return `Posted ${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `Posted ${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `Posted ${days}d ago`;
  return `Posted ${new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
}

function BeatLandingPage() {
  const { beat, global, attachments } = Route.useLoaderData();
  const params = Route.useParams();
  const timer = useOfferTimer(params.slug);

  const [helpOpen, setHelpOpen] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [leaseOpen, setLeaseOpen] = useState(false);
  const [inquiryOpen, setInquiryOpen] = useState(false);

  const videoUrl = beat!.custom_video_url || global?.video_url || null;
  const price = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const showDiscount = timer.active;
  const postedAt = formatPostedAt(beat!.custom_video_recorded_at);

  return (
    <div className="min-h-screen bg-white text-black">
      <header className="mx-auto max-w-5xl px-4 pt-2 sm:pt-4 flex items-center justify-between gap-4">
        <div>
          <div className="text-base sm:text-lg font-black tracking-wide leading-none">MYBEATCATALOG</div>
          <div className="text-[10px] sm:text-xs text-black font-medium mt-0.5">by KRAZYJAYDOTCOM</div>
        </div>
        <button
          onClick={() => setHelpOpen(true)}
          className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs sm:text-sm font-medium text-blue-700 shadow-sm hover:border-blue-300 transition"
        >
          <HeadphonesIcon className="h-4 w-4" />
          Need Help?
        </button>
      </header>

      <main className="mx-auto max-w-4xl px-4 pt-2 sm:pt-3 pb-[120px] sm:pb-[110px]">
        <div className="text-center">
          <h1 className="text-lg sm:text-2xl font-black tracking-tight leading-tight truncate">
            {beat!.title}
          </h1>
          {beat!.producer_name && (
            <div className="text-[11px] sm:text-sm text-gray-500 mt-0.5">prod. {beat!.producer_name}</div>
          )}
        </div>

        {showDiscount && (
          <div className="mt-2 sm:mt-3 rounded-xl bg-blue-50 border border-blue-100 px-3 py-2 flex items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-2 min-w-0">
              <Gift className="h-4 w-4 text-blue-600 shrink-0" />
              <div className="text-xs sm:text-sm truncate">
                <span className="font-bold text-blue-700">50% Off</span>{" "}
                <span className="font-semibold">Unlimited License</span>
              </div>
            </div>
            <div className="flex items-center gap-1 text-blue-700 font-black tabular-nums text-sm sm:text-base">
              <span>{String(timer.min).padStart(2, "0")}</span>
              <span>:</span>
              <span>{String(timer.sec).padStart(2, "0")}</span>
            </div>
          </div>
        )}

        <div className="mt-2 sm:mt-3 rounded-xl overflow-hidden bg-gray-900 aspect-video shadow-lg max-h-[42vh] sm:max-h-[46vh] mx-auto">
          {videoUrl ? (
            <video src={videoUrl} controls playsInline className="w-full h-full object-contain bg-black" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
              No video yet.
            </div>
          )}
        </div>

        {postedAt && (
          <div className="mt-1.5 flex items-center justify-center gap-1.5 text-[11px] sm:text-xs text-gray-500">
            <CalendarClock className="h-3.5 w-3.5 text-blue-500" />
            <span>{postedAt}</span>
          </div>
        )}

        <div className="mt-2 sm:mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
          <button
            onClick={() => setLeaseOpen(true)}
            className="order-1 md:order-2 group rounded-xl border-2 border-blue-500 bg-blue-50 px-4 py-2.5 sm:py-3 text-left transition hover:shadow-lg"
          >
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                <ShoppingBag className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm">
                  Unlimited License (MP3) —{" "}
                  {showDiscount ? (
                    <>
                      <span className="text-blue-700">{price(beat!.discount_price_cents)}</span>{" "}
                      <span className="text-gray-400 line-through text-xs">{price(beat!.price_cents)}</span>
                    </>
                  ) : (
                    <span className="text-blue-700">{price(beat!.price_cents)}</span>
                  )}
                </div>
              </div>
              <div className="text-blue-600">→</div>
            </div>
          </button>

          <button
            onClick={() => setDownloadOpen(true)}
            className="order-2 md:order-1 group rounded-xl border border-gray-200 bg-white px-4 py-2.5 sm:py-3 text-left transition hover:shadow-md hover:border-blue-200"
          >
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                <Download className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1 font-semibold text-sm">Free MP3 Download</div>
              <div className="text-blue-600">→</div>
            </div>
          </button>

          <button
            onClick={() => setInquiryOpen(true)}
            className="order-3 group rounded-xl border border-gray-200 bg-white px-4 py-2.5 sm:py-3 text-left transition hover:shadow-md hover:border-blue-200"
          >
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                <Sparkles className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1 font-semibold text-sm leading-tight">Apply for Exclusive / Custom Work</div>
              <div className="text-blue-600">→</div>
            </div>
          </button>
        </div>

        {attachments && attachments.length > 0 && (
          <section className="mt-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Attachments</h2>
            <ul className="space-y-1.5">
              {attachments.map((a) => <AttachmentRow key={a.id} attachment={a} />)}
            </ul>
          </section>
        )}

        {beat!.seo_description && (
          <section className="mt-8 border-t border-gray-100 pt-5">
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
          slug={params.slug}
          fullPriceCents={beat!.price_cents}
          discountPriceCents={beat!.discount_price_cents}
          checkoutUrl={beat!.checkout_url}
          showDiscount={showDiscount}
          onClose={() => setLeaseOpen(false)}
        />
      )}
      {inquiryOpen && (
        <InquiryModal beatId={beat!.id} beatTitle={beat!.title} onClose={() => setInquiryOpen(false)} />
      )}
      <StickyBottomPlayer
        src={beat!.audio_url || beat!.audio_url_tagged}
        title={beat!.title}
        cover={beat!.cover_url}
        producer={beat!.producer_name}
      />
    </div>
  );
}

function AttachmentRow({ attachment }: { attachment: BeatAttachment }) {
  const size = attachment.size_bytes ? formatBytes(attachment.size_bytes) : null;
  return (
    <li>
      <a
        href={attachment.download_url}
        className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2 hover:border-blue-300 hover:bg-blue-50/50 transition"
      >
        <div className="h-8 w-8 rounded-md bg-blue-100 flex items-center justify-center shrink-0">
          <FileText className="h-4 w-4 text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate">{attachment.filename}</div>
          {size && <div className="text-[11px] text-gray-500">{size}</div>}
        </div>
        <Download className="h-4 w-4 text-blue-600 shrink-0" />
      </a>
    </li>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function ModalShell({ children, onClose, maxWidth = "max-w-md" }: { children: React.ReactNode; onClose: () => void; maxWidth?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-fade-in" onClick={onClose}>
      <div className={`w-full ${maxWidth} rounded-2xl bg-white p-6 shadow-xl animate-scale-in`} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function NeedHelpModal({ global, onClose }: { global: { contact_instagram: string | null; contact_email: string | null; contact_phone: string | null } | null; onClose: () => void }) {
  const ig = global?.contact_instagram;
  const em = global?.contact_email;
  const ph = global?.contact_phone;
  return (
    <ModalShell onClose={onClose} maxWidth="max-w-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-black">Need Help?</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
      </div>
      <div className="mt-4 space-y-2">
        {ig && (
          <a href={ig.startsWith("http") ? ig : `https://instagram.com/${ig.replace(/^@/, "")}`} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-xl border border-gray-200 px-4 py-3 hover:border-blue-300 transition">
            <Instagram className="h-5 w-5 text-blue-600" /><span className="font-medium">Instagram</span>
          </a>
        )}
        {em && (
          <a href={`mailto:${em}`} className="flex items-center gap-3 rounded-xl border border-gray-200 px-4 py-3 hover:border-blue-300 transition">
            <Mail className="h-5 w-5 text-blue-600" /><span className="font-medium">{em}</span>
          </a>
        )}
        {ph && (
          <a href={`tel:${ph}`} className="flex items-center gap-3 rounded-xl border border-gray-200 px-4 py-3 hover:border-blue-300 transition">
            <Phone className="h-5 w-5 text-blue-600" /><span className="font-medium">{ph}</span>
          </a>
        )}
        {!ig && !em && !ph && (
          <p className="text-sm text-gray-500">Contact info not set yet.</p>
        )}
      </div>
    </ModalShell>
  );
}

function DownloadModal({ beatId, onClose }: { beatId: string; onClose: () => void }) {
  const capture = useServerFn(captureBeatLead);
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const downloadHref = `/api/public/beat-free-download?beatId=${encodeURIComponent(beatId)}`;

  const triggerDownload = () => {
    const a = document.createElement("a");
    a.href = downloadHref;
    a.rel = "noopener";
    a.setAttribute("download", "");
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const r = await capture({ data: { beatId, firstName, email } });
      if (!r.downloadUrl) {
        setError("MP3 file not available yet.");
        return;
      }
      setDone(true);
      triggerDownload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell onClose={onClose}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-black">Free MP3 Download</h3>
        <button onClick={onClose} className="text-gray-400"><X className="h-5 w-5" /></button>
      </div>
      {done ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-gray-600">Your download has started — check your Downloads folder. We've also emailed you the link.</p>
          <button onClick={triggerDownload} className="block w-full rounded-xl bg-blue-600 text-white text-center px-5 py-3 font-semibold hover:bg-blue-700">
            Didn't start? Download again
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-4 space-y-3">
          <input required value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-blue-400" />
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-blue-400" />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button disabled={loading} className="w-full rounded-xl bg-blue-600 text-white px-5 py-3 font-semibold hover:bg-blue-700 disabled:opacity-50">
            {loading ? "Preparing..." : "Get Free Download"}
          </button>
        </form>
      )}
    </ModalShell>
  );
}

function LeaseModal({ beatId, slug, fullPriceCents, discountPriceCents, checkoutUrl, showDiscount, onClose }: {
  beatId: string; slug: string; fullPriceCents: number; discountPriceCents: number; checkoutUrl: string | null; showDiscount: boolean; onClose: () => void;
}) {
  const check = useServerFn(checkDiscountEligibility);
  const createSession = useServerFn(createBeatLeaseCheckoutSession);
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
      const origin = window.location.origin;
      const successUrl = `${origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = `${origin}/beats/${slug}`;

      let environment: "sandbox" | "live";
      try { environment = getStripeEnvironment(); }
      catch { throw new Error("Payments are not configured. Please try again later or contact support."); }

      const r = await createSession({
        data: { beatId, email, useDiscount, environment, successUrl, cancelUrl },
      });
      if (r.error) throw new Error(r.error);
      if (r.url) { window.location.href = r.url; return; }
      if (checkoutUrl) { window.location.href = checkoutUrl; return; }
      throw new Error("Checkout is unavailable right now.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const price = (c: number) => `$${(c / 100).toFixed(2)}`;

  return (
    <ModalShell onClose={onClose}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-black">Unlimited License (MP3)</h3>
        <button onClick={onClose} className="text-gray-400"><X className="h-5 w-5" /></button>
      </div>
      <div className="mt-3 text-sm text-gray-500">
        {showDiscount ? (
          <>First-time price: <span className="font-bold text-blue-700">{price(discountPriceCents)}</span> (regular {price(fullPriceCents)})</>
        ) : (
          <>Price: <span className="font-bold">{price(fullPriceCents)}</span></>
        )}
      </div>
      <form onSubmit={submit} className="mt-4 space-y-3">
        <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email for order confirmation" className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-blue-400" />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button disabled={loading} className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 text-white px-5 py-3 font-semibold hover:bg-blue-700 disabled:opacity-50">
          <ShoppingBag className="h-5 w-5" />
          {loading ? "Processing..." : "Continue to Checkout"}
        </button>
        <p className="text-[11px] text-gray-500 text-center leading-snug">
          Purchasing unlimited rights gives you full permission to monetize the song you create with this instrumental.
        </p>
      </form>
    </ModalShell>
  );
}

function InquiryModal({ beatId, beatTitle, onClose }: { beatId: string; beatTitle: string; onClose: () => void }) {
  const listFn = useServerFn(listInquiryQuestions);
  const submitFn = useServerFn(submitBeatInquiry);
  const [questions, setQuestions] = useState<InquiryQuestion[] | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    listFn().then((r) => { if (alive) setQuestions(r.questions); }).catch(() => { if (alive) setQuestions([]); });
    return () => { alive = false; };
  }, [listFn]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      // Required-field check
      for (const q of questions ?? []) {
        if (q.required && !(answers[q.id] ?? "").trim()) {
          throw new Error(`Please fill in: ${q.label}`);
        }
      }
      await submitFn({ data: { beatId, name, email, answers } });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell onClose={onClose} maxWidth="max-w-lg">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-black">Apply for Exclusive / Custom Work</h3>
        <button onClick={onClose} className="text-gray-400"><X className="h-5 w-5" /></button>
      </div>
      {done ? (
        <div className="mt-4 space-y-3 text-sm">
          <p className="text-gray-700">Thanks — your inquiry about <strong>{beatTitle}</strong> was sent. KrazyJay will reply directly.</p>
          <button onClick={onClose} className="w-full rounded-xl bg-blue-600 text-white px-5 py-3 font-semibold hover:bg-blue-700">Close</button>
        </div>
      ) : questions === null ? (
        <p className="mt-4 text-sm text-gray-500">Loading…</p>
      ) : (
        <form onSubmit={submit} className="mt-4 space-y-3 max-h-[65vh] overflow-y-auto pr-1">
          <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-blue-400" />
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-blue-400" />
          {questions.map((q) => (
            <div key={q.id}>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                {q.label}{q.required && <span className="text-red-500">*</span>}
              </label>
              {q.field_type === "textarea" ? (
                <textarea
                  rows={3}
                  value={answers[q.id] ?? ""}
                  onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                  placeholder={q.placeholder ?? ""}
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-blue-400"
                />
              ) : (
                <input
                  type={q.field_type === "email" ? "email" : "text"}
                  value={answers[q.id] ?? ""}
                  onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                  placeholder={q.placeholder ?? ""}
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-blue-400"
                />
              )}
            </div>
          ))}
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button disabled={loading} className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 text-white px-5 py-3 font-semibold hover:bg-blue-700 disabled:opacity-50">
            <Sparkles className="h-4 w-4" />
            {loading ? "Sending..." : "Send Inquiry"}
          </button>
        </form>
      )}
    </ModalShell>
  );
}

function StickyBottomPlayer({ src, title, cover, producer }: { src: string | null; title: string; cover: string | null; producer?: string | null }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [dur, setDur] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);

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

  const seek = (v: number) => {
    if (audioRef.current) audioRef.current.currentTime = v;
    setPos(v);
  };

  const setVol = (v: number) => {
    setVolume(v);
    if (audioRef.current) { audioRef.current.volume = v; audioRef.current.muted = v === 0; }
    setMuted(v === 0);
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    if (audioRef.current) audioRef.current.muted = next;
  };

  const fmt = (s: number) => {
    if (!isFinite(s)) return "00:00";
    const m = Math.floor(s / 60), sec = Math.floor(s % 60);
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  if (!src) return null;
  return (
    <div className="fixed bottom-0 inset-x-0 z-40 border-t border-gray-200 bg-white/95 backdrop-blur shadow-[0_-4px_20px_rgba(0,0,0,0.06)] pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto max-w-4xl px-3 sm:px-4 py-2.5 sm:py-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1 sm:flex-none sm:w-56">
            <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-lg overflow-hidden bg-blue-100 flex-shrink-0">
              {cover ? <img src={cover} alt="" className="w-full h-full object-cover" /> : null}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold truncate">{title}</div>
              <div className="text-[11px] text-gray-500 truncate">Prod. by {producer || "KrazyJay"}</div>
            </div>
          </div>

          <div className="flex-1 flex items-center gap-3 min-w-0">
            <button
              onClick={toggle}
              className="h-11 w-11 rounded-full bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 flex-shrink-0 shadow-md"
              aria-label={playing ? "Pause" : "Play"}
            >
              {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
            </button>
            <div className="hidden sm:flex items-center gap-2 flex-1 min-w-0">
              <span className="text-[11px] text-gray-500 tabular-nums w-10 text-right">{fmt(pos)}</span>
              <input
                type="range"
                min={0}
                max={dur || 1}
                step={0.1}
                value={pos}
                onChange={(e) => seek(Number(e.target.value))}
                className="flex-1 accent-blue-600 min-w-0"
                aria-label="Seek"
              />
              <span className="text-[11px] text-gray-500 tabular-nums w-10">{fmt(dur)}</span>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-2 w-32 flex-shrink-0">
            <button onClick={toggleMute} className="text-gray-500 hover:text-gray-700" aria-label="Mute">
              <Volume2 className={`h-5 w-5 ${muted ? "opacity-40" : ""}`} />
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={muted ? 0 : volume}
              onChange={(e) => setVol(Number(e.target.value))}
              className="flex-1 accent-blue-600"
              aria-label="Volume"
            />
          </div>
        </div>

        <div className="mt-1.5 flex items-center gap-2 sm:hidden">
          <span className="text-[11px] text-gray-500 tabular-nums w-10 text-right">{fmt(pos)}</span>
          <input
            type="range"
            min={0}
            max={dur || 1}
            step={0.1}
            value={pos}
            onChange={(e) => seek(Number(e.target.value))}
            className="flex-1 accent-blue-600"
            aria-label="Seek"
          />
          <span className="text-[11px] text-gray-500 tabular-nums w-10">{fmt(dur)}</span>
        </div>

        <audio ref={audioRef} src={src} preload="metadata" />
      </div>
    </div>
  );
}
