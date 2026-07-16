import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { HeadphonesIcon, Play, Pause, Volume2, Download, Gift, Instagram, Mail, Phone, X, ShoppingBag, FileText, Sparkles, CalendarClock, Zap, Infinity as InfinityIcon, Lock, DollarSign, ArrowRight, SkipBack, SkipForward, Menu, Users } from "lucide-react";

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
  const [menuOpen, setMenuOpen] = useState(false);
  const [licenseOpen, setLicenseOpen] = useState(false);

  const videoUrl = beat!.custom_video_url || global?.video_url || null;
  const price = (cents: number) => `$${(cents / 100).toFixed(2)}`.replace(/\.00$/, "");
  const showDiscount = timer.active;
  const postedAt = formatPostedAt(beat!.custom_video_recorded_at);
  const activePrice = showDiscount ? beat!.discount_price_cents : beat!.price_cents;


  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white text-slate-900">
      {/* HEADER */}
      <header className="mx-auto max-w-6xl px-4 sm:px-6 pt-4 sm:pt-6 flex items-center justify-between gap-4">
        <div>
          <div className="text-xl sm:text-2xl font-black tracking-tight leading-none">
            <span className="text-slate-900">MYBEAT</span><span className="text-blue-600">CATALOG</span>
          </div>
          <div className="text-[10px] sm:text-xs text-slate-500 font-semibold tracking-wide mt-0.5">by KRAZYJAYDOTCOM</div>
        </div>
        <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-700">
          <button onClick={() => setLicenseOpen(true)} className="hover:text-blue-600 transition">Licensing Info</button>
          <button onClick={() => setHelpOpen(true)} className="hover:text-blue-600 transition">Contact</button>
        </nav>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setHelpOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-white px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs sm:text-sm font-semibold text-blue-700 shadow-sm hover:border-blue-400 hover:shadow transition"
          >
            <HeadphonesIcon className="h-4 w-4" />
            <span>Need Help?</span>
          </button>
          <button
            onClick={() => setMenuOpen(true)}
            className="md:hidden inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white h-9 w-9 text-slate-700"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 sm:px-6 pt-2 sm:pt-4 pb-[96px]">
        {/* DISCOUNT PILL */}
        {showDiscount && (
          <div className="rounded-full bg-blue-50 border border-blue-200 px-3 py-1 flex items-center justify-center gap-2 shadow-sm">
            <Gift className="h-3.5 w-3.5 text-blue-600 shrink-0" />
            <span className="text-[11px] sm:text-xs"><span className="font-bold text-blue-700">50% Off</span> Unlimited License</span>
            <span className="text-blue-700 font-black tabular-nums text-xs sm:text-sm">
              {String(timer.min).padStart(2, "0")}:{String(timer.sec).padStart(2, "0")}
            </span>
          </div>
        )}

        {/* VIDEO */}
        <div className="relative mt-2 sm:mt-4 rounded-2xl overflow-hidden bg-slate-900 aspect-video sm:aspect-[21/9] max-h-[38vh] sm:max-h-none shadow-[0_20px_60px_-20px_rgba(37,99,235,0.35)] ring-1 ring-slate-200">
          {videoUrl ? (
            <video src={videoUrl} controls playsInline className="w-full h-full object-cover bg-black" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm">No video yet.</div>
          )}
        </div>


        {/* LICENSE THIS BEAT — main CTA */}
        <div className="mt-3 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-[0_20px_60px_-20px_rgba(37,99,235,0.6)] overflow-hidden">
          <div className="p-3 sm:p-4 grid grid-cols-1 md:grid-cols-[1fr_auto] items-center gap-3 sm:gap-4">
            <div className="min-w-0 text-center md:text-left">
              <div className="text-[10px] sm:text-xs font-bold tracking-widest uppercase text-blue-100">License This Beat</div>
              <div className="mt-0.5 flex items-baseline gap-2 justify-center md:justify-start">
                <span className="text-3xl sm:text-4xl font-black tracking-tight">{price(activePrice)}</span>
                {showDiscount && <span className="text-blue-200/80 line-through text-base font-semibold">{price(beat!.price_cents)}</span>}
              </div>
              <p className="mt-1 text-[11px] sm:text-xs text-blue-50 leading-snug">
                Unlimited MP3 · Unlimited songs · Streams &amp; sales · Keep 100% royalties
              </p>
              <button
                onClick={() => setLicenseOpen(true)}
                className="mt-1 text-[11px] sm:text-xs font-semibold text-blue-100 hover:text-white underline underline-offset-2"
              >
                View License Terms
              </button>
            </div>
            <button
              onClick={() => setLeaseOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 hover:bg-black text-white px-5 py-3 font-bold text-sm tracking-wide uppercase shadow-lg transition w-full md:w-auto"
            >
              Purchase License <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* SECONDARY CTAS */}
        <div className="mt-2 sm:mt-3 grid grid-cols-2 gap-2 sm:gap-3">
          <button
            onClick={() => setDownloadOpen(true)}
            className="group rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left hover:border-blue-300 hover:shadow-md transition flex items-center gap-2 sm:gap-3"
          >
            <div className="h-9 w-9 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
              <Download className="h-4 w-4 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-[11px] sm:text-xs uppercase tracking-wide leading-tight">Free Tagged MP3</div>
              <div className="text-[10px] sm:text-[11px] text-slate-500">Evaluation only</div>
            </div>
          </button>

          <button
            onClick={() => setInquiryOpen(true)}
            className="group rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left hover:border-blue-300 hover:shadow-md transition flex items-center gap-2 sm:gap-3"
          >
            <div className="h-9 w-9 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
              <Users className="h-4 w-4 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-[11px] sm:text-xs uppercase tracking-wide leading-tight">Exclusive / Custom</div>
              <div className="text-[10px] sm:text-[11px] text-slate-500">Let's work directly</div>
            </div>
          </button>
        </div>

        {/* TRUST + PAYMENT combined row */}
        <div className="mt-2 sm:mt-3 flex items-center justify-center gap-x-3 gap-y-1 flex-wrap text-[10px] sm:text-[11px] text-slate-600">
          <span className="inline-flex items-center gap-1"><Lock className="h-3 w-3 text-blue-600" />Secure</span>
          <span className="inline-flex items-center gap-1"><Zap className="h-3 w-3 text-blue-600" />Instant</span>
          <span className="inline-flex items-center gap-1"><InfinityIcon className="h-3 w-3 text-blue-600" />Unlimited</span>
          <span className="inline-flex items-center gap-1"><DollarSign className="h-3 w-3 text-blue-600" />100% Royalties</span>
          <span className="text-slate-300">|</span>
          {["VISA", "MC", "AMEX", "APPLE", "GPAY"].map((m) => (
            <span key={m} className="text-[9px] font-bold tracking-wider text-slate-500 border border-slate-200 rounded px-1.5 py-0.5 bg-white">{m}</span>
          ))}
        </div>

        {attachments && attachments.length > 0 && (
          <section className="mt-6">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Attachments</h2>
            <ul className="space-y-1.5">
              {attachments.map((a: BeatAttachment) => <AttachmentRow key={a.id} attachment={a} />)}
            </ul>
          </section>
        )}

        {beat!.seo_description && (
          <section className="mt-8 border-t border-slate-100 pt-5">
            <p className="text-sm text-slate-500 leading-relaxed max-w-3xl mx-auto text-center">{beat!.seo_description}</p>
          </section>
        )}
      </main>


      {helpOpen && <NeedHelpModal global={global} onClose={() => setHelpOpen(false)} />}
      {menuOpen && <MobileMenu onClose={() => setMenuOpen(false)} onHelp={() => { setMenuOpen(false); setHelpOpen(true); }} onLicense={() => { setMenuOpen(false); setLicenseOpen(true); }} />}
      {downloadOpen && <DownloadModal beatId={beat!.id} onClose={() => setDownloadOpen(false)} />}
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
      {licenseOpen && <LicenseTermsModal onClose={() => setLicenseOpen(false)} />}
      <StickyBottomPlayer
        src={beat!.audio_url || beat!.audio_url_tagged}
        title={beat!.title}
        cover={beat!.cover_url}
        producer={beat!.producer_name}
        bpm={beat!.bpm}
        priceLabel={price(activePrice)}
        onLicense={() => setLeaseOpen(true)}
      />
    </div>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <svg className="h-4 w-4 mt-0.5 shrink-0 text-white" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path d="M16.7 5.3a1 1 0 010 1.4l-8 8a1 1 0 01-1.4 0l-4-4a1 1 0 111.4-1.4L8 12.6l7.3-7.3a1 1 0 011.4 0z"/>
      </svg>
      <span>{children}</span>
    </li>
  );
}

function TrustCell({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="h-8 w-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">{icon}</div>
      <div className="text-[10px] sm:text-xs font-semibold text-slate-700 leading-tight">{label}</div>
    </div>
  );
}


function MobileMenu({ onClose, onHelp, onLicense }: { onClose: () => void; onHelp: () => void; onLicense: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 md:hidden animate-fade-in" onClick={onClose}>
      <div className="absolute top-0 right-0 h-full w-72 bg-white p-6 shadow-xl animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <div className="font-black">Menu</div>
          <button onClick={onClose} className="text-slate-400"><X className="h-5 w-5" /></button>
        </div>
        <nav className="space-y-1 text-sm font-semibold">
          <Link to="/" className="block rounded-lg px-3 py-2.5 hover:bg-blue-50 hover:text-blue-700">Catalog</Link>
          <button onClick={onLicense} className="block w-full text-left rounded-lg px-3 py-2.5 hover:bg-blue-50 hover:text-blue-700">Licensing Info</button>
          <button onClick={onHelp} className="block w-full text-left rounded-lg px-3 py-2.5 hover:bg-blue-50 hover:text-blue-700">Contact</button>
        </nav>
      </div>
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

function LicenseTermsModal({ onClose }: { onClose: () => void }) {
  return (
    <ModalShell onClose={onClose} maxWidth="max-w-2xl">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-black">Unlimited Membership License</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
      </div>
      <div className="mt-4 max-h-[70vh] overflow-y-auto pr-1 space-y-4 text-sm text-slate-700 leading-relaxed">
        <div className="flex items-center gap-2 text-xs">
          <FileText className="h-4 w-4 text-blue-600" />
          <span className="font-bold tracking-wider text-blue-600 uppercase">Unlimited License</span>
        </div>
        <p>
          This agreement confirms that the licensee, upon purchase of an unlimited license for the selected beat,
          is granted unlimited, non-exclusive rights to record, release, distribute, perform, and{" "}
          <strong>monetize</strong> music created with this beat across all streaming platforms, social media,
          sync, live performance, and physical/digital sales. The licensee retains{" "}
          <strong>100% of the master recording royalties</strong> for the song they create.
        </p>

        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <h4 className="text-xs font-bold tracking-wider text-blue-700 uppercase">Writer &amp; Publishing Credits (Required)</h4>
          <p className="mt-2 text-sm">
            All songs created using this beat <strong>must</strong> credit the producer as a co-writer and
            publisher on all metadata, splits sheets, distributor uploads (DistroKid, TuneCore, etc.), and PRO
            registrations as follows:
          </p>
          <ul className="mt-3 space-y-1.5 text-sm">
            <li><strong>Writer:</strong> Jason A. Spencer (IPI #: <span className="font-mono">516703075</span>) — <strong>50% writer's share</strong></li>
            <li><strong>Publishing:</strong> March 26th Publishing (IPI #: <span className="font-mono">1213085595</span>) — <strong>50% publisher's share</strong></li>
            <li><strong>PRO:</strong> ASCAP</li>
          </ul>
          <p className="mt-3 text-xs text-slate-500">
            Failure to register these splits accurately voids the monetization rights granted by this license.
          </p>
        </div>

        <p>
          The licensee may <strong>not</strong> resell, redistribute, sublicense, or claim sole ownership of the
          original beat itself.
        </p>
        <p>
          MYBEATCATALOG retains ownership of the underlying composition and production. A dated, uniquely numbered
          copy of this agreement is issued at the time of purchase.
        </p>
      </div>
      <div className="mt-5 flex justify-end">
        <button onClick={onClose} className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 font-semibold text-sm">
          Got it
        </button>
      </div>
    </ModalShell>
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

function StickyBottomPlayer({ src, title, cover, producer, bpm, priceLabel, onLicense }: {
  src: string | null; title: string; cover: string | null; producer?: string | null; bpm?: number | null; priceLabel?: string; onLicense?: () => void;
}) {
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
  const progress = dur ? pos / dur : 0;

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 bg-slate-950 text-white shadow-[0_-10px_40px_rgba(0,0,0,0.35)] pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto max-w-5xl px-3 sm:px-4 py-2.5 sm:py-3">
        <div className="flex items-center gap-2 sm:gap-4">
          {/* cover + title */}
          <div className="flex items-center gap-3 min-w-0 w-40 sm:w-56 shrink-0">
            <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-lg overflow-hidden bg-blue-900 shrink-0 ring-1 ring-white/10">
              {cover ? <img src={cover} alt="" className="w-full h-full object-cover" /> : null}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold truncate">{title}</div>
              <div className="text-[10px] text-slate-400 truncate">Prod. by {producer || "KRAZYJAY"}</div>
              {bpm ? <div className="text-[10px] text-slate-500 truncate">{bpm} BPM</div> : null}
            </div>
          </div>

          {/* transport */}
          <div className="hidden sm:flex items-center gap-1 shrink-0 text-slate-400">
            <button onClick={() => seek(Math.max(0, pos - 10))} aria-label="Back" className="h-8 w-8 hover:text-white flex items-center justify-center">
              <SkipBack className="h-4 w-4" />
            </button>
            <button
              onClick={toggle}
              className="h-11 w-11 rounded-full bg-blue-600 text-white flex items-center justify-center hover:bg-blue-500 shadow-lg mx-1"
              aria-label={playing ? "Pause" : "Play"}
            >
              {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
            </button>
            <button onClick={() => seek(Math.min(dur, pos + 10))} aria-label="Forward" className="h-8 w-8 hover:text-white flex items-center justify-center">
              <SkipForward className="h-4 w-4" />
            </button>
          </div>

          {/* mobile play only */}
          <button
            onClick={toggle}
            className="sm:hidden h-10 w-10 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg shrink-0"
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
          </button>

          {/* mini waveform + time */}
          <div className="flex-1 min-w-0 hidden sm:flex items-center gap-3">
            <MiniWaveform progress={progress} onSeek={(p) => seek(p * (dur || 0))} />
            <span className="text-[10px] text-slate-400 tabular-nums whitespace-nowrap">{fmt(dur)}</span>
          </div>

          {/* volume */}
          <div className="hidden md:flex items-center gap-2 w-24 shrink-0">
            <button onClick={toggleMute} className="text-slate-400 hover:text-white" aria-label="Mute">
              <Volume2 className={`h-4 w-4 ${muted ? "opacity-40" : ""}`} />
            </button>
            <input
              type="range" min={0} max={1} step={0.01}
              value={muted ? 0 : volume}
              onChange={(e) => setVol(Number(e.target.value))}
              className="flex-1 accent-blue-500"
              aria-label="Volume"
            />
          </div>

          {/* license CTA */}
          {priceLabel && onLicense && (
            <button
              onClick={onLicense}
              className="ml-1 sm:ml-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white px-3 sm:px-4 py-2 shadow-lg flex items-center gap-2 shrink-0"
            >
              <div className="hidden sm:block text-left leading-tight">
                <div className="text-[9px] font-bold tracking-widest uppercase text-blue-100">License This Beat</div>
                <div className="text-sm font-black">{priceLabel}</div>
              </div>
              <div className="sm:hidden text-left leading-tight">
                <div className="text-[9px] font-bold tracking-widest uppercase text-blue-100">License</div>
                <div className="text-sm font-black">{priceLabel}</div>
              </div>
              <ShoppingBag className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* mobile progress bar */}
        <div className="mt-1.5 flex items-center gap-2 sm:hidden">
          <span className="text-[10px] text-slate-400 tabular-nums w-9 text-right">{fmt(pos)}</span>
          <input
            type="range" min={0} max={dur || 1} step={0.1}
            value={pos}
            onChange={(e) => seek(Number(e.target.value))}
            className="flex-1 accent-blue-500"
            aria-label="Seek"
          />
          <span className="text-[10px] text-slate-400 tabular-nums w-9">{fmt(dur)}</span>
        </div>

        <audio ref={audioRef} src={src} preload="metadata" />
      </div>
    </div>
  );
}

function MiniWaveform({ progress, onSeek }: { progress: number; onSeek: (p: number) => void }) {
  const bars = 60;
  return (
    <div
      className="relative flex-1 h-8 flex items-end gap-[2px] cursor-pointer select-none"
      onClick={(e) => {
        const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
        const p = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        onSeek(p);
      }}
    >
      {Array.from({ length: bars }).map((_, i) => {
        const h = 20 + Math.abs(Math.sin(i * 0.7) * 60) + Math.abs(Math.cos(i * 0.3) * 20);
        const active = i / bars <= progress;
        return (
          <div
            key={i}
            style={{ height: `${Math.min(100, h)}%` }}
            className={`w-[3px] rounded-sm ${active ? "bg-blue-400" : "bg-slate-700"}`}
          />
        );
      })}
    </div>
  );
}

