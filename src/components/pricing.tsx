import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Check, Crown, Building2 } from "lucide-react";

type Interval = "monthly" | "yearly";

const tiers = [
  {
    name: "Artist / Creator",
    icon: Crown,
    tag: "Most Popular",
    highlight: true,
    desc: "For independent artists ready to level up.",
    monthlyPrice: 49.99,
    yearlyPrice: 599,
    monthlyPlan: "artist_monthly",
    yearlyPlan: "artist_yearly",
    features: [
      "Unlimited streaming of 5,000+ beats",
      "10 beat downloads per month",
      "Unlimited Membership License — full monetization rights",
      "Member-only drops & discounts",
      "Cancel anytime",
    ],
  },
  {
    name: "Label",
    icon: Building2,
    tag: "For Teams",
    highlight: false,
    desc: "Built for labels signing multiple artists.",
    monthlyPrice: 97,
    yearlyPrice: 970,
    monthlyPlan: "label_monthly",
    yearlyPlan: "label_yearly",
    features: [
      "Everything in Artist plan",
      "25 beat downloads per month",
      "Unlimited Membership License — full monetization rights",
      "Up to 5 team members",
      "Exclusive label-only beats",
      "Priority support",
      "Custom production requests",
      "Song submission to Spotify playlists",
      "Cancel anytime",
    ],
  },
];

export function Pricing() {
  const [interval, setInterval] = useState<Interval>("monthly");

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

        <div className="mt-8 inline-flex items-center rounded-full border border-border bg-card p-1">
          {(["monthly", "yearly"] as const).map((opt) => (
            <button
              key={opt}
              onClick={() => setInterval(opt)}
              className={`px-5 py-2 rounded-full text-sm font-bold tracking-wide transition-colors ${
                interval === opt
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {opt === "monthly" ? "Monthly" : "Yearly · save 17%"}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-14 grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
        {tiers.map((tier) => {
          const Icon = tier.icon;
          const price = interval === "monthly" ? tier.monthlyPrice : tier.yearlyPrice;
          const planId = interval === "monthly" ? tier.monthlyPlan : tier.yearlyPlan;
          const linkProps = { to: "/checkout" as const, search: { plan: planId } };

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
                <span className="text-6xl font-black">${price}</span>
                <span className="text-muted-foreground">
                  /{interval === "monthly" ? "month" : "year"}
                </span>
              </div>
              <Button
                variant={tier.highlight ? "hero" : "heroOutline"}
                size="lg"
                className="mt-6 w-full"
                asChild
              >
                <Link {...linkProps}>Get Started</Link>
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
