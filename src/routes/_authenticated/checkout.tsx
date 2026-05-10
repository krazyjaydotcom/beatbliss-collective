import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { StripeEmbeddedCheckoutForm } from "@/components/StripeEmbeddedCheckout";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";

const VALID_PLANS = ["artist_monthly", "artist_yearly", "label_monthly", "label_yearly"] as const;
type PlanId = typeof VALID_PLANS[number];

export const Route = createFileRoute("/_authenticated/checkout")({
  validateSearch: (s: Record<string, unknown>): { plan?: PlanId } => {
    const p = typeof s.plan === "string" ? s.plan : undefined;
    return { plan: VALID_PLANS.includes(p as PlanId) ? (p as PlanId) : undefined };
  },
  component: CheckoutPage,
});

function CheckoutPage() {
  const { plan } = useSearch({ from: "/_authenticated/checkout" });

  if (!plan) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">No plan selected.</p>
          <Link to="/" hash="pricing" className="mt-4 inline-block text-primary hover:underline">
            Choose a plan
          </Link>
        </div>
      </div>
    );
  }

  const returnUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/checkout/return?session_id={CHECKOUT_SESSION_ID}`;

  return (
    <div className="min-h-screen bg-background">
      <PaymentTestModeBanner />
      <main className="container mx-auto px-6 py-10 max-w-3xl">
        <Link to="/" className="text-2xl font-black tracking-tight">
          KRAZYJAY<span className="text-primary">DOTCOM</span>
        </Link>
        <h1 className="mt-8 text-3xl font-bold">Complete your subscription</h1>
        <div className="mt-8 rounded-2xl border border-border bg-card p-2 md:p-4">
          <StripeEmbeddedCheckoutForm priceId={plan} returnUrl={returnUrl} />
        </div>
      </main>
    </div>
  );
}
