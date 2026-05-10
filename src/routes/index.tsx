import { createFileRoute } from "@tanstack/react-router";
import { SiteNav } from "@/components/site-nav";
import { Hero } from "@/components/hero";
import { Features } from "@/components/features";
import { Pricing } from "@/components/pricing";
import { SiteFooter } from "@/components/site-footer";
import { PublicSupportButton } from "@/components/public-support-button";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "KrazyJayDotCom — Premium Beats for Artists & Labels" },
      {
        name: "description",
        content: "Subscription beat store with unlimited streaming. $37/mo for artists, $97/mo for labels. Royalty-free, industry ready.",
      },
    ],
  }),
});

function Index() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <SiteNav />
      <Hero />
      <Features />
      <Pricing />
      <SiteFooter />
      <PublicSupportButton />
    </main>
  );
}
