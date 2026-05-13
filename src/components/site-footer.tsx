import { createFileRoute } from "@tanstack/react-router";
import { Hero } from "@/components/hero";
import { Pricing } from "@/components/pricing";
import { PublicSupportButton } from "@/components/public-support-button";
import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "KRAZYJAYDOTCOM - Private Catalog Membership" },
      {
        name: "description",
        content: "Private beat catalog membership with paid access only and no public browsing.",
      },
    ],
  }),
});

function Index() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <SiteNav />
      <Hero />
      <Pricing />
      <SiteFooter />
      <PublicSupportButton />
    </main>
  );
}
