import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AccessApplicationModal } from "@/components/access-application-modal";
import { Hero } from "@/components/hero";
import { HomeFunnelPlayer } from "@/components/home-funnel-player";
import { HomeGallerySection } from "@/components/home-gallery-section";
import { PublicSupportButton } from "@/components/public-support-button";
import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";
import { StickyOfferBar } from "@/components/funnel/sticky-offer-bar";
import { WhatYouGet } from "@/components/funnel/what-you-get";
import { PricingCard } from "@/components/funnel/pricing-card";
import { FaqSection } from "@/components/funnel/faq-section";
import { getBeatIdBySlug } from "@/lib/beat-slug.functions";

export const Route = createFileRoute("/$slug")({
  loader: async ({ params }) => {
    const res = await getBeatIdBySlug({ data: { slug: params.slug } });
    return { beatId: res.beatId };
  },
  component: SlugBeatPage,
});

function SlugBeatPage() {
  const [applicationOpen, setApplicationOpen] = useState(false);
  const { beatId } = Route.useLoaderData();
  const open = () => setApplicationOpen(true);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <StickyOfferBar onApplyForAccess={open} />
      <SiteNav onApplyForAccess={open} />
      <main className="pb-32">
        <Hero onApplyForAccess={open} />
        <WhatYouGet />
        <PricingCard onApplyForAccess={open} />
        <HomeGallerySection />
        <FaqSection onApplyForAccess={open} />
      </main>
      <SiteFooter onApplyForAccess={open} />
      <PublicSupportButton />
      <AccessApplicationModal open={applicationOpen} onOpenChange={setApplicationOpen} />
      <HomeFunnelPlayer beatId={beatId} onApplyForAccess={open} />
    </div>
  );
}
