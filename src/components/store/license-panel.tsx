import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, FileText, ShieldCheck } from "lucide-react";
import { createBeatLeaseCheckoutSession } from "@/lib/beat-landing.functions";
import { getStripeEnvironment } from "@/lib/stripe";
import { formatPrice } from "@/components/store/player-provider";
import type { StoreBeat } from "@/lib/store.functions";

/** The exact license terms already used on the public beat pages. */
export function LicenseTerms() {
  return (
    <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
        <FileText className="h-4 w-4" />
        Unlimited License
      </div>
      <p>
        This agreement confirms that the licensee, upon purchase of an unlimited license for the
        selected beat, is granted unlimited, non-exclusive rights to record, release, distribute,
        perform, and <strong className="text-foreground">monetize</strong> music created with this
        beat across all streaming platforms, social media, sync, live performance, and
        physical/digital sales. The licensee retains{" "}
        <strong className="text-foreground">100% of the master recording royalties</strong> for the
        song they create.
      </p>
      <div className="rounded-xl border border-primary/25 bg-primary/[0.07] p-4">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-primary">
          Writer &amp; Publishing Credits (Required)
        </h4>
        <p className="mt-2">
          All songs created using this beat <strong className="text-foreground">must</strong> credit
          the producer as a co-writer and publisher on all metadata, splits sheets, distributor
          uploads (DistroKid, TuneCore, etc.), and PRO registrations as follows:
        </p>
        <ul className="mt-3 space-y-1.5">
          <li>
            <strong className="text-foreground">Writer:</strong> Jason A. Spencer (IPI #:{" "}
            <span className="font-mono">516703075</span>) —{" "}
            <strong className="text-foreground">50% writer&apos;s share</strong>
          </li>
          <li>
            <strong className="text-foreground">Publishing:</strong> March 26th Publishing (IPI #:{" "}
            <span className="font-mono">1213085595</span>) —{" "}
            <strong className="text-foreground">50% publisher&apos;s share</strong>
          </li>
          <li>
            <strong className="text-foreground">PRO:</strong> ASCAP
          </li>
        </ul>
        <p className="mt-3 text-xs">
          Failure to register these splits accurately voids the monetization rights granted by this
          license.
        </p>
      </div>
      <p>
        The licensee may <strong className="text-foreground">not</strong> resell, redistribute,
        sublicense, or claim sole ownership of the original beat itself.
      </p>
      <p>
        MYBEATCATALOG retains ownership of the underlying composition and production. A dated,
        uniquely numbered copy of this agreement is issued at the time of purchase.
      </p>
    </div>
  );
}

export function LicenseCheckout({ beat }: { beat: StoreBeat }) {
  const createSession = useServerFn(createBeatLeaseCheckoutSession);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const origin = window.location.origin;
      let environment: "sandbox" | "live";
      try {
        environment = getStripeEnvironment();
      } catch {
        throw new Error("Payments are not configured. Please try again later or contact support.");
      }
      const r = await createSession({
        data: {
          beatId: beat.id,
          email,
          useDiscount: false,
          environment,
          successUrl: `${origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: beat.slug ? `${origin}/beats/${beat.slug}` : origin,
        },
      });
      if (r.error) throw new Error(r.error);
      if (r.url) {
        window.location.href = r.url;
        return;
      }
      throw new Error("Checkout is unavailable right now.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-semibold tabular-nums text-foreground">
          {formatPrice(beat.priceCents)}
        </span>
        <span className="text-xs uppercase tracking-wider text-muted-foreground">
          Unlimited license
        </span>
      </div>
      <ul className="space-y-1 text-sm text-muted-foreground">
        <li>Unlimited MP3 · unlimited songs</li>
        <li>Streams, sales and monetization</li>
        <li>Keep 100% of your master royalties</li>
      </ul>
      <input
        required
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email for your license and files"
        className="h-11 w-full rounded-xl border border-white/12 bg-white/[0.04] px-4 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/60"
      />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <button
        type="submit"
        disabled={loading}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold uppercase tracking-wide text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
      >
        {loading ? "Opening checkout…" : "Continue to checkout"}
        {loading ? null : <ArrowRight className="h-4 w-4" />}
      </button>
      <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5" /> Secure payment · license document issued on purchase
      </p>
    </form>
  );
}
