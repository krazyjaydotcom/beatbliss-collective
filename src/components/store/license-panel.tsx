import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, FileText, Plus, ShieldCheck } from "lucide-react";
import { formatPrice } from "@/components/store/player-provider";
import { useCart } from "@/components/store/cart-provider";
import { InlineCheckout } from "@/components/store/inline-checkout";
import { TIER_META, TIER_ORDER, tierPriceCents, type LicenseTier } from "@/lib/licensing";
import { cn } from "@/lib/utils";
import type { StoreBeat } from "@/lib/store.functions";
import { trackPurchaseFunnel } from "@/lib/purchase-attribution";


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
  compact = false,
  tier: tierProp,
  onTierChange,
}: {
  beat: StoreBeat;
  paying?: boolean;
  onPayingChange?: (paying: boolean) => void;
  compact?: boolean;
  tier?: LicenseTier;
  onTierChange?: (tier: LicenseTier) => void;
}) {
  const cart = useCart();
  const [localTier, setLocalTier] = useState<LicenseTier>("nonexclusive");
  const tier = tierProp ?? localTier;
  const setTier = (next: LicenseTier) => {
    setLocalTier(next);
    onTierChange?.(next);
  };
  const [detailsTier, setDetailsTier] = useState<LicenseTier | null>(null);
  const [termsOpen, setTermsOpen] = useState(false);
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

  const selectTier = (next: LicenseTier) => {
    setTier(next);
    trackPurchaseFunnel("license_selected", beat.id, next);
  };

  const beginCheckout = () => {
    trackPurchaseFunnel("buy_now_clicked", beat.id, tier);
    setPaying(true);
  };

  const essential =
    tier === "nonexclusive"
      ? "Physical sales + promotional performances. No streaming rights."
      : tier === "trackout"
        ? "Unlimited rights. STEMs may take up to 24 hours for delivery."
        : "Unlimited streaming and monetization rights. Delivery details are emailed after payment.";


  if (isPaying) {
    return (
      <div className="flex min-h-0 flex-1 flex-col animate-in fade-in duration-300 motion-reduce:animate-none">
        <button
          type="button"
          onClick={() => setPaying(false)}
          className="mb-3 inline-flex h-10 items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to licensing
        </button>
        <div className="min-h-0 flex-1 overflow-y-auto"><InlineCheckout items={checkoutItems} /></div>
      </div>
    );
  }

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col animate-in fade-in duration-300 motion-reduce:animate-none", !compact && "gap-4")}>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
        <h3 className="mb-2 text-sm font-semibold tracking-tight text-foreground">License this beat</h3>
      <div className="grid gap-1.5" role="radiogroup" aria-label="License type">
        {TIER_ORDER.map((t) => {
          const p = tierPriceCents(beat, t);
          const active = t === tier;
          const detailsOpen = detailsTier === t;
          return (
            <div
              key={t}
              className={cn(
                 "rounded-lg border transition-colors",
                active
                  ? "border-primary/60 bg-primary/[0.08]"
                  : "border-white/10 bg-white/[0.02] hover:border-white/25",
              )}
            >
              <button
                type="button"
                role="radio"
                aria-checked={active}
                 onClick={() => selectTier(t)}
                 className="flex min-h-11 w-full items-center gap-2.5 px-3 py-2 text-left"
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
               {active ? <p className="px-3 pb-1 pl-10 text-[11px] leading-snug text-foreground/80">{t === "nonexclusive" ? "Physical sales + promotional performances. No streaming rights." : t === "trackout" ? "STEMs may take up to 24 hours for delivery." : "Unlimited streaming and monetization rights."}</p> : null}
               <button
                type="button"
                aria-expanded={detailsOpen}
                aria-controls={`license-details-${t}`}
                onClick={() => setDetailsTier(detailsOpen ? null : t)}
                 className="ml-10 mb-1.5 min-h-7 px-3 text-left text-[11px] font-medium text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
              >
                {detailsOpen ? "Hide details" : "License details"}
              </button>
              {detailsOpen ? (
                <div
                  id={`license-details-${t}`}
                   className="animate-in fade-in max-h-40 overflow-y-auto border-t border-white/10 px-3 py-2 text-xs leading-relaxed text-muted-foreground duration-200 motion-reduce:animate-none"
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
      <button type="button" onClick={() => setTermsOpen((v) => !v)} className="my-2 min-h-8 text-left text-xs font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground" aria-expanded={termsOpen}>
        {termsOpen ? "Hide full license terms" : "Read full license terms"}
      </button>
      {termsOpen ? <LicenseTerms /> : null}
      </div>

      {!inquiryOnly ? (
        <div className="shrink-0 border-t border-white/10 bg-card pt-2 pb-[max(.25rem,env(safe-area-inset-bottom))]">
          <p className="mb-2 line-clamp-2 text-[11px] leading-snug text-muted-foreground"><strong className="text-foreground">{TIER_META[tier].label}:</strong> {essential}</p>
          <div className="grid grid-cols-[minmax(0,.72fr)_minmax(0,1.28fr)] gap-2">
          <button
            type="button"
            onClick={addToCart}
            disabled={inCart}
            className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border border-white/15 px-2 text-xs font-medium text-foreground transition-colors hover:border-primary/60 hover:text-primary disabled:opacity-60"
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
            onClick={beginCheckout}
            className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl bg-primary px-2 text-xs font-semibold uppercase tracking-wide text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {`Buy now · ${formatPrice(price)}`}
            <ArrowRight className="h-4 w-4" />
          </button>
          </div>
          <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" /> Secure payment here · delivery details emailed after payment
          </p>
        </div>
      ) : null}

    </div>
  );
}
