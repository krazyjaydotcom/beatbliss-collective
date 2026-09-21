import { useCallback, useMemo, useState } from "react";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2 } from "lucide-react";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createCartCheckoutSession } from "@/lib/cart.functions";
import type { LicenseTier } from "@/lib/licensing";

export interface InlineCheckoutItem {
  beatId: string;
  tier: LicenseTier;
}

/**
 * Stripe's payment form rendered in place, inside the cart drawer or the
 * license panel. The page never navigates, so the audio element — and the
 * beat the visitor is listening to — keeps playing while they pay.
 */
export function InlineCheckout({
  items,
  onComplete,
}: {
  items: InlineCheckoutItem[];
  onComplete?: () => void;
}) {
  const create = useServerFn(createCartCheckoutSession);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Keep the item list stable for the provider: changing the options object
  // after the session exists makes Stripe throw.
  const payload = useMemo(
    () => items.map((i) => ({ beatId: i.beatId, tier: i.tier })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items.map((i) => `${i.beatId}:${i.tier}`).join("|")],
  );

  const fetchClientSecret = useCallback(async (): Promise<string> => {
    let environment: "sandbox" | "live";
    try {
      environment = getStripeEnvironment();
    } catch {
      const msg = "Payments are not configured yet. Please try again later.";
      setError(msg);
      throw new Error(msg);
    }
    const r = await create({
      data: {
        items: payload,
        environment,
        returnUrl: `${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
      },
    });
    if (r.error || !r.clientSecret) {
      const msg = r.error ?? "Checkout is unavailable right now.";
      setError(msg);
      throw new Error(msg);
    }
    setError(null);
    return r.clientSecret;
  }, [create, payload]);

  const options = useMemo(
    () => ({
      fetchClientSecret,
      onComplete: () => {
        setDone(true);
        onComplete?.();
      },
    }),
    [fetchClientSecret, onComplete],
  );

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
        <p className="font-semibold text-destructive">Checkout unavailable</p>
        <p className="mt-1 text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="space-y-2 rounded-xl border border-primary/40 bg-primary/[0.07] p-5 text-center">
        <CheckCircle2 className="mx-auto h-7 w-7 text-primary" aria-hidden />
        <p className="text-sm font-semibold text-foreground">Payment complete</p>
        <p className="text-sm text-muted-foreground">
          Your download links and license document are on their way by email. Your music never
          stopped playing.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-white/[0.02] p-1">
      <EmbeddedCheckoutProvider stripe={getStripe()} options={options}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
