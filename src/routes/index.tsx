import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { AccessApplicationModal } from "@/components/access-application-modal";
import { Hero } from "@/components/hero";
import { HomeFunnelPlayer } from "@/components/home-funnel-player";
import { HomeGallerySection } from "@/components/home-gallery-section";
import { PublicSupportButton } from "@/components/public-support-button";
import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";

import { WhatYouGet } from "@/components/funnel/what-you-get";
import { FaqSection } from "@/components/funnel/faq-section";

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
  const open = () => setApplicationOpen(true);

  return (
    <div className="min-h-screen bg-background text-foreground">
      
      <SiteNav onApplyForAccess={open} />
      <main className="pb-32">
        <Hero onApplyForAccess={open} />
        <WhatYouGet />
        <HomeGallerySection />
        <FaqSection onApplyForAccess={open} />
      </main>
      <SiteFooter onApplyForAccess={open} />
      <PublicSupportButton />
      <AccessApplicationModal open={applicationOpen} onOpenChange={setApplicationOpen} />
      <HomeFunnelPlayer beatId={beatId ?? null} onApplyForAccess={open} />
    </div>
  );
}
