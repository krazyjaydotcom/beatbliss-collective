import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AccessApplicationModal } from "@/components/access-application-modal";
import { Hero } from "@/components/hero";
import { PublicSupportButton } from "@/components/public-support-button";
import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";

export const Route = createFileRoute("/")({
  component: IndexPage,
});

function IndexPage() {
  const [applicationOpen, setApplicationOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav onApplyForAccess={() => setApplicationOpen(true)} />
      <main>
        <Hero onApplyForAccess={() => setApplicationOpen(true)} />
      </main>
      <SiteFooter onApplyForAccess={() => setApplicationOpen(true)} />
      <PublicSupportButton />
      <AccessApplicationModal open={applicationOpen} onOpenChange={setApplicationOpen} />
    </div>
  );
}