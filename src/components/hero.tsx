import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Crown, Lock, MessageSquareText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import heroImage from "@/assets/hero-producer.jpg";

type HeroProps = {
  onApplyForAccess?: () => void;
};

type HomepageSettings = {
  hero_media_type: "image" | "video";
  hero_media_url: string | null;
};

const DEFAULT_HOMEPAGE_SETTINGS: HomepageSettings = {
  hero_media_type: "image",
  hero_media_url: null,
};

export function Hero({ onApplyForAccess }: HeroProps) {
  const settingsQ = useQuery({
    queryKey: ["homepage-settings"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("homepage_settings")
        .select("hero_media_type, hero_media_url")
        .eq("id", "main")
        .maybeSingle();
      if (error || !data) return DEFAULT_HOMEPAGE_SETTINGS;
      return {
        hero_media_type: data.hero_media_type === "video" ? "video" : "image",
        hero_media_url: data.hero_media_url || null,
      } as HomepageSettings;
    },
  });
  const media = settingsQ.data ?? DEFAULT_HOMEPAGE_SETTINGS;
  const customMediaUrl = media.hero_media_url?.trim();

  return (
    <section className="relative overflow-hidden pt-24 pb-12 lg:min-h-[calc(100vh-0px)] lg:flex lg:items-center">
      <div className="absolute inset-0 -z-10" style={{ background: "var(--gradient-radial-red)" }} />
      <div className="container mx-auto grid items-center gap-10 px-6 lg:grid-cols-2">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-2 text-xs font-bold tracking-wider">
            <Crown className="h-3.5 w-3.5 text-primary" />
            PRIVATE MEMBERSHIP ACCESS
          </div>
          <h1 className="mt-5 text-4xl font-black leading-[0.95] tracking-tight md:text-6xl lg:text-7xl">
            PREMIUM ACCESS TO
            <br />
            <span className="text-primary">HIGH QUALITY BEATS.</span>
          </h1>
          <p className="mt-5 max-w-xl text-base text-muted-foreground md:text-lg">
            Private access to cinematic, inspirational beats built for artists with a message. Apply for access, unlock the catalog, and stay close to KrazyJay.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            {onApplyForAccess ? (
              <Button size="xl" variant="hero" type="button" onClick={onApplyForAccess}>
                Apply For Access
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            ) : (
              <Button size="xl" variant="hero" asChild>
                <Link to="/checkout">
                  Apply For Access
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            )}
            <Button size="xl" variant="heroOutline" asChild>
              <Link to="/login">Member Login</Link>
            </Button>
          </div>
          <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
            <Lock className="h-4 w-4 text-primary" />
            <span>Private membership - Application required - Member-only access</span>
          </div>
          <div className="mt-6 inline-flex items-center gap-2 text-sm text-muted-foreground">
            <MessageSquareText className="h-4 w-4 text-primary" />
            Direct line to KrazyJay after signup.
          </div>
        </div>
        <div className="relative">
          <div className="absolute inset-0 rounded-[2rem] bg-primary/10 blur-3xl" />
          {customMediaUrl && media.hero_media_type === "video" ? (
            <video
              src={customMediaUrl}
              className="relative mx-auto aspect-[4/3] w-full max-w-2xl rounded-[2rem] border border-border object-cover shadow-2xl"
              autoPlay
              muted
              loop
              playsInline
              poster={heroImage}
            />
          ) : (
            <img
              src={customMediaUrl || heroImage}
              alt="Producer in the studio"
              className="relative mx-auto w-full max-w-2xl rounded-[2rem] border border-border object-cover shadow-2xl"
            />
          )}
        </div>
      </div>
    </section>
  );
}
