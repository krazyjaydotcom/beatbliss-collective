import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, FileText, Check } from "lucide-react";
import { KrazyLogo } from "@/components/krazy-logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/license-example")({
  head: () => ({ meta: [{ title: "Unlimited License Example — MYBEATCATALOG" }] }),
  component: LicenseExamplePage,
});

function LicenseExamplePage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Link to="/account" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <Link to="/"><KrazyLogo className="text-xl" /></Link>
            <Badge variant="secondary">EXAMPLE</Badge>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-10 max-w-3xl">
        <h1 className="text-3xl md:text-4xl font-black tracking-tight">Unlimited Membership License — Example</h1>
        <p className="mt-2 text-muted-foreground">
          This is a sample of the agreement you'll receive every time you download a beat as a paid member.
          Every download generates a uniquely numbered, dated copy in your account.
        </p>

        <div className="mt-8 rounded-2xl border border-border bg-card p-6 md:p-8 space-y-6">
          <div className="flex items-center gap-2 text-xs">
            <FileText className="h-4 w-4 text-primary" />
            <span className="font-bold tracking-wider text-primary">UNLIMITED MEMBERSHIP LICENSE</span>
          </div>

          <p className="text-sm leading-relaxed">
            This agreement confirms that the user, as an active paid member of MYBEATCATALOG, has downloaded the
            selected beat using their available membership credits. The user is granted unlimited, non-exclusive
            rights to record, release, distribute, perform, and <strong>monetize</strong> music created with this
            beat across all streaming platforms, social media, sync, live performance, and physical/digital sales.
            The user retains <strong>100% of the master recording royalties</strong> for the song they create.
          </p>

          <div className="rounded-xl border border-primary/40 bg-primary/5 p-5">
            <h2 className="text-sm font-bold tracking-wider text-primary">WRITER &amp; PUBLISHING CREDITS (REQUIRED)</h2>
            <p className="mt-2 text-sm">
              All songs created using this beat <strong>must</strong> credit the producer as a co-writer and
              publisher on all metadata, splits sheets, distributor uploads (DistroKid, TuneCore, etc.), and PRO
              registrations as follows:
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <span><strong>Writer credit:</strong> Jason A. Spencer (IPI #: <span className="font-mono">516703075</span>) — <strong>50% writer's share</strong></span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <span><strong>Publishing:</strong> March 26th Publishing (IPI #: <span className="font-mono">1213085595</span>) — <strong>50% publisher's share</strong></span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <span><strong>PRO:</strong> ASCAP</span>
              </li>
            </ul>
            <p className="mt-4 text-xs text-muted-foreground">
              Failure to register these splits accurately voids the monetization rights granted by this license.
            </p>
          </div>

          <div className="space-y-2 text-sm">
            <p>
              The user may <strong>not</strong> resell, redistribute, sublicense, or claim sole ownership of the
              original beat itself.
            </p>
            <p>
              MYBEATCATALOG retains ownership of the underlying composition and production. This license remains
              valid for music released during the active membership period.
            </p>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Button variant="hero" asChild>
            <Link to="/beats">Browse beats</Link>
          </Button>
          <Button variant="heroOutline" asChild>
            <Link to="/agreements">View my agreements</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
