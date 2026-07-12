import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { AccessApplicationModal } from "@/components/access-application-modal";
import { Hero } from "@/components/hero";
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
  const open = () => setApplicationOpen(true);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav onApplyForAccess={open} />
      <main>
        <Hero onApplyForAccess={open} />
      </main>
      <SiteFooter onApplyForAccess={open} />
      <PublicSupportButton />
      <AccessApplicationModal open={applicationOpen} onOpenChange={setApplicationOpen} />
    </div>
  );
}
