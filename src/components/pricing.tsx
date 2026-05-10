import { Button } from "@/components/ui/button";
import { Check, Crown, Building2 } from "lucide-react";

const tiers = [
  {
    name: "Artist / Creator",
    price: 37,
    icon: Crown,
    tag: "Most Popular",
    highlight: true,
    desc: "For independent artists ready to level up.",
    features: [
      "Unlimited streaming of 5,000+ beats",
      "10 beat downloads per month",
      "Royalty-free for non-commercial use",
      "Standard licensing for releases",
      "Member-only drops & discounts",
      "Cancel anytime",
    ],
  },
  {
    name: "Label",
    price: 97,
    icon: Building2,
    tag: "For Teams",
    highlight: false,
    desc: "Built for labels signing multiple artists.",
    features: [
      "Everything in Artist plan",
      "Unlimited downloads",
      "Extended commercial licensing",
      "Up to 10 team members",
      "Exclusive label-only beats",
      "Priority producer requests",
      "Dedicated account manager",
    ],
  },
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
        <p className="mt-4 text-muted-foreground">
          Simple, fair pricing. Pick the plan that fits your hustle.
        </p>
      </div>

      <div className="mt-14 grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
        {tiers.map((tier) => {
          const Icon = tier.icon;
          return (
            <div
              key={tier.name}
              className={`relative rounded-3xl border p-8 md:p-10 ${
                tier.highlight
                  ? "border-primary bg-card shadow-[var(--shadow-glow)]"
                  : "border-border bg-card"
              }`}
            >
              {tier.tag && (
                <div className="absolute -top-3 left-8 rounded-full bg-primary px-3 py-1 text-xs font-bold tracking-wider text-primary-foreground">
                  {tier.tag}
                </div>
              )}
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-2xl font-bold">{tier.name}</h3>
              </div>
              <p className="mt-3 text-muted-foreground">{tier.desc}</p>
              <div className="mt-6 flex items-baseline gap-2">
                <span className="text-6xl font-black">${tier.price}</span>
                <span className="text-muted-foreground">/month</span>
              </div>
              <Button
                variant={tier.highlight ? "hero" : "heroOutline"}
                size="lg"
                className="mt-6 w-full"
              >
                Get Started
              </Button>
              <ul className="mt-8 space-y-3">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-sm">
                    <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
