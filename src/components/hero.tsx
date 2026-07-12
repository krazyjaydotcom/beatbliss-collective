import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import heroImage from "@/assets/hero-producer.jpg";

type HeroProps = {
  onApplyForAccess?: () => void;
};

export type HeroImageFilter = {
  grayscale?: number; // 0-100
  sepia?: number; // 0-100
  brightness?: number; // 50-200 (100 = normal)
  contrast?: number; // 50-200
  saturate?: number; // 0-200
  blur?: number; // 0-20 (px)
  hueRotate?: number; // 0-360
};

type HomepageSettings = {
  hero_media_type: "image" | "video";
  hero_media_url: string | null;
  hero_image_filter: HeroImageFilter;
};

const DEFAULT_HOMEPAGE_SETTINGS: HomepageSettings = {
  hero_media_type: "image",
  hero_media_url: null,
  hero_image_filter: {},
};

export function heroFilterToCss(f: HeroImageFilter | null | undefined): string | undefined {
  if (!f) return undefined;
  const parts: string[] = [];
  if (f.grayscale) parts.push(`grayscale(${f.grayscale}%)`);
  if (f.sepia) parts.push(`sepia(${f.sepia}%)`);
  if (typeof f.brightness === "number" && f.brightness !== 100) parts.push(`brightness(${f.brightness}%)`);
  if (typeof f.contrast === "number" && f.contrast !== 100) parts.push(`contrast(${f.contrast}%)`);
  if (typeof f.saturate === "number" && f.saturate !== 100) parts.push(`saturate(${f.saturate}%)`);
  if (f.blur) parts.push(`blur(${f.blur}px)`);
  if (f.hueRotate) parts.push(`hue-rotate(${f.hueRotate}deg)`);
  return parts.length ? parts.join(" ") : undefined;
}

export function Hero({ onApplyForAccess }: HeroProps) {
  const settingsQ = useQuery({
    queryKey: ["homepage-settings"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("homepage_settings")
        .select("hero_media_type, hero_media_url, hero_image_filter")
        .eq("id", "main")
        .maybeSingle();
      if (error || !data) return DEFAULT_HOMEPAGE_SETTINGS;
      return {
        hero_media_type: data.hero_media_type === "video" ? "video" : "image",
        hero_media_url: data.hero_media_url || null,
        hero_image_filter: (data.hero_image_filter as HeroImageFilter) || {},
      } as HomepageSettings;
    },
  });
  const media = settingsQ.data ?? DEFAULT_HOMEPAGE_SETTINGS;
  const customMediaUrl = media.hero_media_url?.trim();
  const filterCss = heroFilterToCss(media.hero_image_filter);

  return (
    <section className="relative overflow-hidden pt-32 pb-12 lg:min-h-[calc(100vh-0px)] lg:flex lg:items-center">
      <div className="absolute inset-0 -z-10" style={{ background: "var(--gradient-radial-red)" }} />
      <div className="container mx-auto grid items-center gap-10 px-6 lg:grid-cols-2">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">
            MYBEATCATALOG <span className="text-primary">by KRAZYJAYDOTCOM</span>
          </p>
          <h1 className="mt-4 text-4xl font-black leading-[0.95] tracking-tight md:text-6xl lg:text-7xl">
            Find Your Next Record in 60 Seconds.
          </h1>
          <p className="mt-4 max-w-xl text-base text-muted-foreground md:text-lg">
            Private membership access. Apply below or log in if you're already a member.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            {onApplyForAccess ? (
              <Button size="xl" variant="hero" type="button" onClick={onApplyForAccess}>
                Apply for Access
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            ) : (
              <Button size="xl" variant="hero" asChild>
                <Link to="/apply">
                  Apply for Access
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            )}
            <Button size="xl" variant="heroOutline" asChild>
              <Link to="/login">Member Login</Link>
            </Button>
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
              style={filterCss ? { filter: filterCss } : undefined}
            />
          )}
        </div>
      </div>
    </section>
  );
}
