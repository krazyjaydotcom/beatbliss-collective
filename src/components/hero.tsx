import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Check, Crown, Headphones, Lock } from "lucide-react";
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
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-4 py-2 text-xs font-bold tracking-wider text-primary">
            <Crown className="h-3.5 w-3.5" />
            PRIVATE MEMBERSHIP ACCESS
          </div>
          <h1 className="mt-5 text-4xl font-black leading-[0.95] tracking-tight md:text-6xl lg:text-7xl">
            12 BEATS / MONTH.
            <br />
            <span className="text-primary">$49.99/MO.</span>
          </h1>
          <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-amber-300">
            ⚡ Limited time offer
          </p>
          <p className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-primary md:text-base">
            <Headphones className="h-4 w-4" /> Your beat is playing below — and there's a whole catalog more.
          </p>
          <p className="mt-3 max-w-xl text-base text-muted-foreground md:text-lg">
            Download up to 12 beats every month, with full monetization rights and a direct line to KrazyJay. Cancel anytime.
          </p>

          <ul className="mt-6 space-y-2.5 text-sm md:text-base">
            <li className="flex items-center gap-2.5">
              <Check className="h-4 w-4 shrink-0 text-primary" />
              <span>Download up to 12 beats from the catalog every month</span>
            </li>
            <li className="flex items-center gap-2.5">
              <Check className="h-4 w-4 shrink-0 text-primary" />
              <span>Full monetization rights — release on every platform</span>
            </li>
            <li className="flex items-center gap-2.5">
              <Check className="h-4 w-4 shrink-0 text-primary" />
              <span>Cancel anytime — no contracts, no surprises</span>
            </li>
          </ul>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            {onApplyForAccess ? (
              <Button size="xl" variant="hero" type="button" onClick={onApplyForAccess}>
                Get Full Access — $49.99/mo
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            ) : (
              <Button size="xl" variant="hero" asChild>
                <Link to="/checkout">
                  Get Full Access — $49.99/mo
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            )}
            <Button size="xl" variant="heroOutline" asChild>
              <Link to="/login">Member Login</Link>
            </Button>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground sm:text-sm">
            <span className="inline-flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 text-primary" />
              Application required
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-emerald-400" />
              Cancel anytime
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-emerald-400" />
              Approved in hours
            </span>
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
