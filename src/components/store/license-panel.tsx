import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Check, FileText, Plus, ShieldCheck } from "lucide-react";
import { formatPrice } from "@/components/store/player-provider";
import { useCart } from "@/components/store/cart-provider";
import { InlineCheckout } from "@/components/store/inline-checkout";
import { TIER_META, TIER_ORDER, tierPriceCents, type LicenseTier } from "@/lib/licensing";
import { cn } from "@/lib/utils";
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

export function LicenseCheckout({
  beat,
  paying,
  onPayingChange,
}: {
  beat: StoreBeat;
  paying?: boolean;
  onPayingChange?: (paying: boolean) => void;
}) {
  const cart = useCart();
  const [tier, setTier] = useState<LicenseTier>("unlimited");
  const [detailsTier, setDetailsTier] = useState<LicenseTier | null>(null);
  const [localPaying, setLocalPaying] = useState(false);
  const isPaying = paying ?? localPaying;
  const setPaying = (next: boolean) => {
    setLocalPaying(next);
    onPayingChange?.(next);
  };

  const price = useMemo(() => tierPriceCents(beat, tier), [beat, tier]);
  const inquiryOnly = price === null;
  const inCart = cart.has(beat.id, tier);
  const checkoutItems = useMemo(() => [{ beatId: beat.id, tier }], [beat.id, tier]);

  const addToCart = () => {
    if (price === null) return;
    cart.add({
      beatId: beat.id,
      title: beat.title,
      producerName: beat.producerName,
      coverUrl: beat.coverUrl,
      slug: beat.slug,
      tier,
      priceCents: price,
    });
  };


  if (isPaying) {
    return (
      <div className="animate-in fade-in duration-300 motion-reduce:animate-none">
        <button
          type="button"
          onClick={() => setPaying(false)}
          className="mb-3 inline-flex h-10 items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to licensing
        </button>
        <InlineCheckout items={checkoutItems} />
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-300 motion-reduce:animate-none space-y-4">
      <div className="grid gap-2" role="radiogroup" aria-label="License type">
        {TIER_ORDER.map((t) => {
          const p = tierPriceCents(beat, t);
          const active = t === tier;
          const detailsOpen = detailsTier === t;
          return (
            <div
              key={t}
              className={cn(
                "rounded-xl border transition-colors",
                active
                  ? "border-primary/60 bg-primary/[0.08]"
                  : "border-white/10 bg-white/[0.02] hover:border-white/25",
              )}
            >
              <button
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setTier(t)}
                className="flex w-full items-center gap-3 px-3 pb-1 pt-3 text-left"
              >
                <span
                  className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                    active ? "border-primary bg-primary text-primary-foreground" : "border-white/30",
                  )}
                >
                  {active ? <Check className="h-3 w-3" /> : null}
                </span>
                <span className="flex min-w-0 flex-1 items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold text-foreground">{TIER_META[t].label}</span>
                  <span className="text-sm font-semibold tabular-nums text-foreground">
                    {p === null ? "Inquire" : formatPrice(p)}
                  </span>
                </span>
              </button>
              <button
                type="button"
                aria-expanded={detailsOpen}
                aria-controls={`license-details-${t}`}
                onClick={() => setDetailsTier(detailsOpen ? null : t)}
                className="ml-10 mb-2 px-3 text-left text-xs font-medium text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
              >
                {detailsOpen ? "Hide details" : "License details"}
              </button>
              {detailsOpen ? (
                <div
                  id={`license-details-${t}`}
                  className="animate-in fade-in border-t border-white/10 px-3 py-3 text-xs leading-relaxed text-muted-foreground duration-200 motion-reduce:animate-none"
                >
                  <p>{TIER_META[t].blurb}</p>
                  <ul className="mt-2 space-y-1">
                    {TIER_META[t].bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {inquiryOnly ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Exclusive rights for this beat are priced case by case. Send an inquiry and you&apos;ll
            get a reply with terms.
          </p>
          {beat.slug ? (
            <Link
              to="/beats/$slug"
              params={{ slug: beat.slug }}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-primary/50 text-sm font-semibold uppercase tracking-wide text-primary"
            >
              Send exclusive inquiry
            </Link>
          ) : null}
        </div>
      ) : (
        <div className="space-y-3">
          <button
            type="button"
            onClick={addToCart}
            disabled={inCart}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/15 text-sm font-medium text-foreground transition-colors hover:border-primary/60 hover:text-primary disabled:opacity-60"
          >
            {inCart ? (
              <>
                <Check className="h-4 w-4" /> In your cart
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" /> Add to cart
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => setPaying(true)}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold uppercase tracking-wide text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {`Buy now · ${formatPrice(price)}`}
            <ArrowRight className="h-4 w-4" />
          </button>
          <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" /> Secure payment right here · your music keeps
            playing
          </p>
        </div>
      )}

    </div>
  );
}
