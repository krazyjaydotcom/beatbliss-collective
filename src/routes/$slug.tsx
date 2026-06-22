import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AccessApplicationModal } from "@/components/access-application-modal";
import { Hero } from "@/components/hero";
import { HomeFunnelPlayer } from "@/components/home-funnel-player";
import { HomeGallerySection } from "@/components/home-gallery-section";
import { PublicSupportButton } from "@/components/public-support-button";
import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";
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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav onApplyForAccess={() => setApplicationOpen(true)} />
      <main className="pb-32">
        <Hero onApplyForAccess={() => setApplicationOpen(true)} />
        <HomeGallerySection />
      </main>
      <SiteFooter onApplyForAccess={() => setApplicationOpen(true)} />
      <PublicSupportButton />
      <AccessApplicationModal open={applicationOpen} onOpenChange={setApplicationOpen} />
      <HomeFunnelPlayer beatId={beatId} onApplyForAccess={() => setApplicationOpen(true)} />
    </div>
  );
}
