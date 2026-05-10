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

  const fetchClientSecret = async (): Promise<string> => {
    const cs = await create({
      data: { priceId, returnUrl, environment: getStripeEnvironment() },
    });
    if (!cs) throw new Error("Failed to create checkout session");
    return cs;
  };

  return (
    <div id="checkout">
      <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
