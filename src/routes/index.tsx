import { createFileRoute } from "@tanstack/react-router";
import { Hero } from "@/components/hero";
import { PublicSupportButton } from "@/components/public-support-button";
import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";

export const Route = createFileRoute("/")({
  component: IndexPage,
});

function IndexPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav />
      <main>
        <Hero />
      </main>
      <SiteFooter />
      <PublicSupportButton />
    </div>
  );
}
