import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Check, Crown } from "lucide-react";

const FEATURES = [
  "Unlimited streaming of 5,000+ beats",
  "25 beat downloads per month",
  "Unlimited Membership License — full monetization rights",
  "Direct text message access to KrazyJay",
  "Email support",
  "Private music marketing courses",
  "Member-only drops & discounts",
  "Cancel anytime",
];

export function Pricing() {
  return (
    <section id="pricing" className="container mx-auto px-6 py-20">
      <div className="text-center max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-2 text-xs font-bold tracking-wider">
          PRICING
        </div>
        <h2 className="mt-5 text-4xl md:text-5xl font-black tracking-tight">
          ONE PRICE. <span className="text-primary">UNLIMITED SOUND.</span>
        </h2>
        <p className="mt-4 text-muted-foreground">Simple, fair pricing. Cancel anytime.</p>
      </div>

      <div className="mt-14 max-w-xl mx-auto">
        <div className="relative rounded-3xl border border-primary bg-card p-8 md:p-10 shadow-[var(--shadow-glow)]">
          <div className="absolute -top-3 left-8 rounded-full bg-primary px-3 py-1 text-xs font-bold tracking-wider text-primary-foreground">
            Most Popular
          </div>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center">
              <Crown className="h-5 w-5 text-primary" />
            </div>
            <h3 className="text-2xl font-bold">Catalog Membership</h3>
          </div>
          <p className="mt-3 text-muted-foreground">
            Full access to the catalog, monetization rights, and direct line to KrazyJay.
          </p>
          <div className="mt-6 flex items-baseline gap-2">
            <span className="text-6xl font-black">$49.99</span>
            <span className="text-muted-foreground">/month</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Billed monthly. Cancel anytime.</p>
          <Button variant="hero" size="lg" className="mt-6 w-full" asChild>
            <Link to="/checkout" search={{ plan: "artist_monthly" }}>
              Get Started
            </Link>
          </Button>
          <ul className="mt-8 space-y-3">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-3 text-sm">
                <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
