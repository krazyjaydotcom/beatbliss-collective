import { useCallback, useMemo, useState } from "react";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2 } from "lucide-react";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createCartCheckoutSession } from "@/lib/cart.functions";
import type { LicenseTier } from "@/lib/licensing";
import { getPurchaseAttribution } from "@/lib/purchase-attribution";

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
  const [codeInput, setCodeInput] = useState("");
  const [code, setCode] = useState("");
  const [note, setNote] = useState<string | null>(null);

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
        ...(code ? { discountCode: code } : {}),
        returnUrl: `${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
        attribution: getPurchaseAttribution(),
      },
    });
    if (r.error || !r.clientSecret) {
      const msg = r.error ?? "Checkout is unavailable right now.";
      setError(msg);
      throw new Error(msg);
    }
    setError(null);
    setNote(r.discountNote ?? null);
    return r.clientSecret;
  }, [create, payload, code]);

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

  const codeBox = (
    <form
      className="mb-2 flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        setNote(null);
        setCode(codeInput.trim().toUpperCase());
      }}
    >
      <input
        value={codeInput}
        onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
        placeholder="Discount code"
        aria-label="Discount code"
        className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
      />
      <button type="submit" disabled={!codeInput.trim()} className="rounded-md border border-border px-3 text-sm font-semibold disabled:opacity-50">
        Apply
      </button>
      {code && (
        <button type="button" onClick={() => { setCode(""); setCodeInput(""); setError(null); setNote(null); }} className="text-xs text-muted-foreground underline">
          Remove
        </button>
      )}
    </form>
  );

  if (error) {
    return (
      <div>
        {codeBox}
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
          <p className="font-semibold text-destructive">{code ? "Code not applied" : "Checkout unavailable"}</p>
          <p className="mt-1 text-muted-foreground">{error}</p>
        </div>
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
    <div>
    {codeBox}
    {note && <p className="mb-2 text-xs font-semibold text-primary">{note}</p>}
    <div className="rounded-xl bg-white/[0.02] p-1">
      <EmbeddedCheckoutProvider key={code || "none"} stripe={getStripe()} options={options}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
    </div>
  );
}
