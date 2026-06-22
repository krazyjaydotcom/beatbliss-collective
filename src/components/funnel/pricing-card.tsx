import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  onApplyForAccess: () => void;
};

const FEATURES = [
  "Unlimited downloads from the full catalog",
  "Full monetization rights — keep 100% of your masters",
  "New beats added every week",
  "Members-only exclusive releases",
  "Direct messaging with KrazyJay",
  "WAV + MP3 stems on every beat",
  "Cancel anytime, no questions asked",
];

export function PricingCard({ onApplyForAccess }: Props) {
  return (
    <section id="pricing" className="bg-background py-16 sm:py-24">
      <div className="container mx-auto px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">Membership</p>
          <h2 className="mt-3 text-3xl font-black tracking-tight md:text-4xl">
            One price. The whole catalog.
          </h2>
          <p className="mt-3 text-muted-foreground">
            Less than the cost of one custom beat — every single month.
          </p>
        </div>

        <div className="relative mx-auto mt-10 max-w-lg">
          <div className="absolute -inset-1 rounded-3xl bg-gradient-to-br from-primary/40 via-primary/10 to-primary/40 blur-xl" />
          <div className="relative rounded-3xl border-2 border-primary/40 bg-card p-8 shadow-[0_24px_80px_rgba(0,0,0,0.4)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-primary">Full Access</p>
                <h3 className="mt-1 text-2xl font-black">MYBEATCATALOG</h3>
              </div>
              <span className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-300">
                Cancel anytime
              </span>
            </div>

            <div className="mt-6 flex items-end gap-2">
              <span className="text-5xl font-black tracking-tight">$49.99</span>
              <span className="pb-2 text-sm text-muted-foreground">/ month</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Billed monthly — no contracts, no hidden fees.</p>

            <ul className="mt-6 space-y-3">
              {FEATURES.map((f) => (
                <li key={f} className="flex gap-3 text-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            <Button
              size="xl"
              variant="hero"
              type="button"
              onClick={onApplyForAccess}
              className="mt-8 w-full"
            >
              Get Full Access — $49.99/mo
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <p className="mt-3 text-center text-[11px] uppercase tracking-wider text-muted-foreground">
              Private membership · Application required
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
