import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createGuestCheckoutSession } from "@/lib/payments.functions";
import { Button } from "@/components/ui/button";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { KrazyLogo } from "@/components/krazy-logo";

const VALID_PLANS = ["artist_monthly", "artist_monthly_v2", "artist_yearly", "label_monthly", "label_yearly"] as const;
type PlanId = (typeof VALID_PLANS)[number];

const PLAN_LABEL: Record<PlanId, string> = {
  artist_monthly: "Catalog Membership — $49.99/mo",
  artist_monthly_v2: "Catalog Membership — $49.99/mo",
  artist_yearly: "Catalog Membership — $599/yr",
  label_monthly: "Label — $97/mo",
  label_yearly: "Label — $970/yr",
};

export const Route = createFileRoute("/checkout")({
  validateSearch: (s: Record<string, unknown>): { plan?: PlanId; email?: string; claim?: string } => {
    const p = typeof s.plan === "string" ? s.plan : undefined;
    return {
      plan: VALID_PLANS.includes(p as PlanId) ? (p as PlanId) : undefined,
      email: typeof s.email === "string" ? s.email : undefined,
      claim: typeof s.claim === "string" ? s.claim : undefined,
    };
  },
  component: CheckoutPage,
});

function CheckoutPage() {
  const search = useSearch({ from: "/checkout" }) as { plan?: PlanId; email?: string; claim?: string };
  const plan = search.plan;
  const initialEmail = typeof search.email === "string" ? search.email.trim().toLowerCase() : "";
  const [email, setEmail] = useState(initialEmail);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(initialEmail || null);

  if (!plan) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">No plan selected.</p>
          <Link to="/" className="mt-4 inline-block text-primary hover:underline">
            Return home
          </Link>
        </div>
      </div>
    );
  }
  const planLabel = PLAN_LABEL[plan];

  return (
    <div className="min-h-screen bg-background">
      <PaymentTestModeBanner />
      <main className="container mx-auto px-6 py-10 max-w-2xl">
        <Link to="/">
          <KrazyLogo className="text-2xl" />
        </Link>
        <h1 className="mt-8 text-3xl font-bold">Complete your subscription</h1>
        <p className="mt-2 text-muted-foreground">{PLAN_LABEL[plan]}</p>

        {!submittedEmail ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (email.trim()) setSubmittedEmail(email.trim().toLowerCase());
            }}
            className="mt-8 rounded-2xl border border-border bg-card p-6 space-y-4"
          >
            <div>
              <label className="text-sm font-medium">Your email</label>
              <p className="text-xs text-muted-foreground mt-1">
                We'll send your account claim link here after payment.
              </p>
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <Button type="submit" variant="hero" size="lg" className="w-full">
              Continue to payment
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Already a member?{" "}
              <Link to="/login" className="text-primary hover:underline">
                Log in
              </Link>
            </p>
          </form>
        ) : (
          <div className="mt-8 rounded-2xl border border-border bg-card p-2 md:p-4">
            <p className="px-4 pt-2 text-sm text-muted-foreground">
              Paying as <span className="text-foreground font-medium">{submittedEmail}</span> ·{" "}
              <button type="button" onClick={() => setSubmittedEmail(null)} className="text-primary hover:underline">
                change
              </button>
            </p>
            <CheckoutForm plan={plan} email={submittedEmail} claimToken={search.claim} />
          </div>
        )}
      </main>
    </div>
  );
}

function CheckoutForm({ plan, email, claimToken }: { plan: PlanId; email: string; claimToken?: string }) {
  const create = useServerFn(createGuestCheckoutSession);
  const [error, setError] = useState<string | null>(null);

  const fetchClientSecret = async (): Promise<string> => {
    const returnUrl = `${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`;
    const result = await create({
      data: { priceId: plan, email, returnUrl, environment: getStripeEnvironment(), claimToken },
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
      <div className="m-2 rounded-lg border border-destructive/40 bg-destructive/10 p-6 text-sm">
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
