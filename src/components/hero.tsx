import { Button } from "@/components/ui/button";
import { ArrowRight, Crown } from "lucide-react";
import heroImage from "@/assets/hero-producer.jpg";

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-32 pb-20">
      <div
        className="absolute inset-0 -z-10"
        style={{ background: "var(--gradient-radial-red)" }}
      />
      <div className="container mx-auto grid lg:grid-cols-2 gap-12 px-6 items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-2 text-xs font-bold tracking-wider">
            <Crown className="h-3.5 w-3.5 text-primary" />
            PREMIUM BEATS. UNLIMITED POSSIBILITIES.
          </div>
          <h1 className="mt-6 text-5xl md:text-7xl font-black leading-[0.95] tracking-tight">
            PREMIUM BEATS.
            <br />
            REAL ARTISTS.
            <br />
            <span className="text-primary">REAL RESULTS.</span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-md">
            Unlimited streaming. Fair prices.
            <br />
            Keep your credits. Unlock your sound.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Button variant="hero" size="xl">
              Start Free <ArrowRight className="ml-1 h-5 w-5" />
            </Button>
            <Button variant="heroOutline" size="xl">
              Browse Beats
            </Button>
          </div>
          <div className="mt-10">
            <p className="text-sm text-muted-foreground">Trusted by 10,000+ artists worldwide</p>
            <div className="mt-3 flex -space-x-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="h-10 w-10 rounded-full border-2 border-background bg-gradient-to-br from-muted to-secondary"
                />
              ))}
              <div className="h-10 w-10 rounded-full border-2 border-background bg-primary flex items-center justify-center text-xs font-bold">
                10K+
              </div>
            </div>
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
