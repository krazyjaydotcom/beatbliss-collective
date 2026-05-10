import { useState } from "react";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { useServerFn } from "@tanstack/react-start";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createCheckoutSession } from "@/lib/payments.functions";

interface Props {
  priceId: string;
  returnUrl: string;
}

export function StripeEmbeddedCheckoutForm({ priceId, returnUrl }: Props) {
  const create = useServerFn(createCheckoutSession);
  const [error, setError] = useState<string | null>(null);

  const fetchClientSecret = async (): Promise<string> => {
    const result = await create({
      data: { priceId, returnUrl, environment: getStripeEnvironment() },
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
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-6 text-sm">
        <p className="font-semibold text-destructive">Checkout unavailable</p>
        <p className="mt-2 text-muted-foreground">{error}</p>
      </div>
    );
  }

  return (
    <div id="checkout">
      <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
