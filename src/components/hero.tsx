import { Button } from "@/components/ui/button";
import { ArrowRight, Crown, Music, ShieldCheck, Infinity as InfinityIcon } from "lucide-react";
import heroImage from "@/assets/hero-producer.jpg";

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-24 pb-10 lg:min-h-[calc(100vh-0px)] lg:flex lg:items-center">
      <div
        className="absolute inset-0 -z-10"
        style={{ background: "var(--gradient-radial-red)" }}
      />
      <div className="container mx-auto grid lg:grid-cols-2 gap-10 px-6 items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-2 text-xs font-bold tracking-wider">
            <Crown className="h-3.5 w-3.5 text-primary" />
            PREMIUM BEATS. UNLIMITED POSSIBILITIES.
          </div>
          <h1 className="mt-5 text-4xl md:text-6xl lg:text-7xl font-black leading-[0.95] tracking-tight">
            PREMIUM BEATS.
            <br />
            REAL ARTISTS.
            <br />
            <span className="text-primary">REAL RESULTS.</span>
          </h1>
          <p className="mt-5 text-base md:text-lg text-muted-foreground max-w-md">
            Unlimited streaming. Fair prices. Keep your credits. Unlock your sound.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button variant="hero" size="xl">
              Start Free <ArrowRight className="ml-1 h-5 w-5" />
            </Button>
            <Button variant="heroOutline" size="xl">
              Browse Beats
            </Button>
          </div>

          <div className="mt-8 grid grid-cols-3 gap-3 max-w-md">
            <Feature icon={InfinityIcon} label="Unlimited streaming" />
            <Feature icon={ShieldCheck} label="100% royalty-free" />
            <Feature icon={Music} label="New beats weekly" />
          </div>
        </div>
        <div className="relative">
          <div
            className="absolute -inset-4 rounded-3xl blur-2xl opacity-60"
            style={{ background: "var(--gradient-primary)" }}
          />
          <img
            src={heroImage}
            alt="Music producer in studio with red neon lighting"
            width={1024}
            height={1024}
            className="relative rounded-2xl w-full h-auto object-cover aspect-square shadow-[var(--shadow-card)]"
          />
        </div>
      </div>
    </section>
  );
}

function Feature({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <div className="flex flex-col items-start gap-1.5">
      <div className="h-9 w-9 rounded-lg border border-primary/30 bg-primary/10 flex items-center justify-center">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <span className="text-xs font-semibold text-muted-foreground leading-tight">{label}</span>
    </div>
  );
}
