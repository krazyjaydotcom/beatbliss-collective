import { createFileRoute, Link } from "@tanstack/react-router";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { InlineCheckout } from "@/components/store/inline-checkout";
import { KrazyLogo } from "@/components/krazy-logo";
import { TIER_META, tierPriceCents, type LicenseTier } from "@/lib/licensing";
import { getPaymentLinkBeat } from "@/lib/payment-link.functions";

const searchSchema = z.object({
  tier: fallback(z.enum(["nonexclusive", "unlimited", "trackout"]), "nonexclusive").default("nonexclusive"),
  code: fallback(z.string().regex(/^[a-zA-Z0-9_-]{3,30}$/).optional(), undefined),
  email: fallback(z.string().email().max(255).optional(), undefined),
});

export const Route = createFileRoute("/pay/$beatId")({
  validateSearch: zodValidator(searchSchema),
  loader: ({ params }) => getPaymentLinkBeat({ data: { beatRef: params.beatId } }),
  head: ({ loaderData }) => {
    const title = loaderData ? `License ${loaderData.title} — MYBEATCATALOG` : "Beat checkout — MYBEATCATALOG";
    const description = loaderData
      ? `Choose your license for ${loaderData.title} and complete secure payment on MYBEATCATALOG.`
      : "Secure beat license checkout on MYBEATCATALOG.";
    return { meta: [
      { title }, { name: "description", content: description },
      { property: "og:title", content: title }, { property: "og:description", content: description },
      { property: "og:type", content: "product" }, { name: "twitter:card", content: "summary" },
      ...(loaderData?.coverUrl?.startsWith("https://") ? [
        { property: "og:image", content: loaderData.coverUrl },
        { name: "twitter:image", content: loaderData.coverUrl },
      ] : []),
    ] };
  },
  component: PaymentLinkPage,
});

function PaymentLinkPage() {
  const beat = Route.useLoaderData();
  const { tier, code, email } = Route.useSearch();
  if (!beat) return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-5 text-center text-foreground">
      <h1 className="text-2xl font-semibold">This beat is unavailable</h1>
      <p className="text-muted-foreground">The link may have changed or this beat is no longer for sale.</p>
      <Link to="/" className="text-primary underline">Browse beats</Link>
    </main>
  );
  const price = tierPriceCents(beat, tier as LicenseTier);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <PaymentTestModeBanner />
      <header className="border-b border-border px-4 py-4 sm:px-6">
        <div className="mx-auto max-w-3xl"><Link to="/" aria-label="MYBEATCATALOG home"><KrazyLogo className="text-xl" /></Link></div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6 pb-16 sm:px-6">
        <div className="flex items-center gap-4 border-b border-border pb-5">
          {beat.coverUrl && <img src={beat.coverUrl} alt="" className="h-16 w-16 shrink-0 rounded-md object-cover sm:h-20 sm:w-20" />}
          <div className="min-w-0">
            <h1 className="text-xl font-semibold sm:text-2xl">{beat.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{TIER_META[tier].label}</p>
            {price !== null && <p className="mt-1 text-lg font-semibold tabular-nums">${(price / 100).toFixed(2)}{code ? " before discount" : ""}</p>}
          </div>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">{TIER_META[tier].blurb}</p>
        {price === null ? (
          <p className="mt-6 text-sm text-destructive">This license is not available for this beat.</p>
        ) : (
          <section aria-label="Secure payment" className="mt-6">
            <InlineCheckout key={`${beat.id}:${tier}:${code ?? ""}:${email ?? ""}`} items={[{ beatId: beat.id, tier }]} initialCode={code} buyerEmail={email} />
          </section>
        )}
        <Link to="/" className="mt-8 inline-block text-sm text-muted-foreground underline hover:text-foreground">Browse more beats</Link>
      </main>
    </div>
  );
}