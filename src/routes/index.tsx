import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { AccessApplicationModal } from "@/components/access-application-modal";
import { Hero } from "@/components/hero";
import { HomeFunnelPlayer } from "@/components/home-funnel-player";
import { PublicSupportButton } from "@/components/public-support-button";
import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";

const searchSchema = z.object({
  b: fallback(z.string().uuid().optional(), undefined),
});

export const Route = createFileRoute("/")({
  validateSearch: zodValidator(searchSchema),
  component: IndexPage,
});

function IndexPage() {
  const [applicationOpen, setApplicationOpen] = useState(false);
  const { b: beatId } = Route.useSearch();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav onApplyForAccess={() => setApplicationOpen(true)} />
      <main className="pb-32">
        <Hero onApplyForAccess={() => setApplicationOpen(true)} />
      </main>
      <SiteFooter onApplyForAccess={() => setApplicationOpen(true)} />
      <PublicSupportButton />
      <AccessApplicationModal open={applicationOpen} onOpenChange={setApplicationOpen} />
      <HomeFunnelPlayer beatId={beatId ?? null} onApplyForAccess={() => setApplicationOpen(true)} />
    </div>
  );
}
