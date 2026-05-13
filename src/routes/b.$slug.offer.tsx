import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Check, Crown } from "lucide-react";
import { CountdownTimer } from "@/components/CountdownTimer";
import { getFunnelBySlug } from "@/lib/funnels.functions";
import { KrazyLogo } from "@/components/krazy-logo";

export const Route = createFileRoute("/b/$slug/offer")({
  validateSearch: (s: Record<string, unknown>): { e?: string; t?: string } => ({
    e: typeof s.e === "string" ? s.e : undefined,
    t: typeof s.t === "string" ? s.t : undefined,
  }),
  loader: async ({ params }) => {
    const result = await getFunnelBySlug({ data: { slug: params.slug } });
    return result;
  },
  head: () => ({
    meta: [{ title: "Your beat is on the way — unlock the full catalog" }],
  }),
  component: OfferPage,
});

const FEATURES = [
  "Unlimited streaming of 5,000+ beats",
  "25 beat downloads per month",
  "Unlimited Membership License — full monetization rights",
  "Direct text message access to KrazyJay",
  "Email support",
  "Private music marketing courses",
];

function OfferPage() {
  const { funnel } = Route.useLoaderData();
  const search = useSearch({ from: "/b/$slug/offer" });
  const params = Route.useParams();
  const email = search.e;
  const startedAt = search.t ?? new Date().toISOString();

  if (!funnel) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Funnel not found.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container mx-auto px-6 py-4">
          <KrazyLogo className="text-xl" />
        </div>
      </header>

      <main className="container mx-auto px-6 py-10 max-w-3xl">
        {/* Confirmation */}
        <div className="rounded-2xl border border-border bg-card p-6 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-bold tracking-wider text-primary">
            YOU'RE IN
          </span>
          <h1 className="mt-4 text-3xl md:text-4xl font-black">
            {email ? (
              <>
                <span className="text-primary">{email}</span> — you're on the list
              </>
            ) : (
              "You're on the list"
            )}
          </h1>
          <p className="mt-2 text-muted-foreground">
            Before you go — this offer is only available right now. Read carefully.
          </p>
        </div>

        {/* Pitch */}
        <div className="mt-8 rounded-3xl border border-primary bg-card p-8 md:p-10 shadow-[var(--shadow-glow)] relative">
          <div className="absolute -top-3 left-8 rounded-full bg-primary px-3 py-1 text-xs font-bold tracking-wider text-primary-foreground">
            One-time offer
          </div>

          <CountdownTimer startedAt={startedAt} durationHours={12} className="mt-2" />

          <div className="mt-8 flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center">
              <Crown className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold">Unlock the full catalog</h2>
          </div>
          <p className="mt-3 text-muted-foreground">
            Get private access to my full catalog — cinematic, inspirational beats built for artists with a message.
          </p>

          <ul className="mt-6 space-y-3">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-3 text-sm">
                <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <span>{f}</span>
              </li>
            ))}
          </ul>

          <div className="mt-8 grid md:grid-cols-2 gap-4">
            <Link
              to="/checkout"
              search={{ plan: "artist_yearly" }}
              className="block rounded-2xl border-2 border-primary bg-primary/5 p-5 hover:bg-primary/10 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider font-bold text-primary">Best value</span>
                <span className="text-xs text-muted-foreground">save $44+/yr</span>
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-4xl font-black">$599</span>
                <span className="text-muted-foreground">/year</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">One payment. Full year access.</p>
            </Link>

            <Link
              to="/checkout"
              search={{ plan: "artist_monthly_v2" }}
              className="block rounded-2xl border border-border bg-card p-5 hover:border-primary/50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider font-bold text-muted-foreground">Monthly</span>
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-4xl font-black">$49.99</span>
                <span className="text-muted-foreground">/month</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">Billed monthly. Cancel anytime.</p>
            </Link>
          </div>

          <Button variant="hero" size="lg" className="mt-6 w-full" asChild>
            <Link to="/checkout" search={{ plan: "artist_yearly" }}>
              Get Catalog Access
            </Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
