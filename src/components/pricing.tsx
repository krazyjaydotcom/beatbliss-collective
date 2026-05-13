import { Link } from "@tanstack/react-router";
import { Check, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";

const FEATURES = [
  "Private catalog access",
  "Unlimited licensing for your releases",
  "Direct line to KrazyJay",
  "Private classroom and support",
  "Cancel anytime",
];

export function Pricing() {
  return (
    <section id="pricing" className="container mx-auto px-6 py-20">
      <div className="mx-auto max-w-2xl text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-2 text-xs font-bold tracking-wider">
          PRICING
        </div>
        <h2 className="mt-5 text-4xl font-black tracking-tight md:text-5xl">
          PRIVATE ACCESS. <span className="text-primary">CLEAR TERMS.</span>
        </h2>
        <p className="mt-4 text-muted-foreground">A simple monthly membership for artists who want the catalog and direct support.</p>
      </div>

      <div className="mx-auto mt-14 max-w-xl">
        <div className="relative rounded-3xl border border-primary bg-card p-8 shadow-2xl shadow-primary/10 md:p-10">
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full border border-primary bg-background px-4 py-1 text-xs font-bold tracking-[0.3em] text-primary">
            MEMBERSHIP
          </div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                <Crown className="h-3.5 w-3.5 text-primary" />
                Catalog Membership
              </div>
              <p className="mt-4 max-w-md text-sm leading-6 text-muted-foreground">
                Private access to cinematic, inspirational beats built for artists with a message. Direct line to KrazyJay. Cancel anytime.
              </p>
            </div>
            <div className="text-right">
              <div className="text-4xl font-black leading-none">$49.99</div>
              <div className="mt-2 text-xs uppercase tracking-[0.25em] text-muted-foreground">per month</div>
            </div>
          </div>

          <div className="mt-8 space-y-3">
            {FEATURES.map((feature) => (
              <div key={feature} className="flex items-start gap-3 rounded-2xl border border-border/80 bg-secondary/30 px-4 py-3">
                <Check className="mt-0.5 h-4 w-4 text-primary" />
                <span className="text-sm text-foreground/90">{feature}</span>
              </div>
            ))}
          </div>

          <Button className="mt-8 w-full" size="xl" variant="hero" asChild>
            <Link to="/checkout">Apply For Access</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
