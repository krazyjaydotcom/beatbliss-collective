/**
 * License tiers offered on the storefront.
 *
 * - Non-Exclusive: the cheaper entry tier. Price comes from the beat when the
 *   producer has set one, otherwise the shared default below.
 * - Unlimited: the existing $49.99 license, unchanged wording and terms.
 * - Exclusive: per-beat price set in admin. When no price is set the beat is
 *   inquiry-only — we never invent a number.
 */

export type LicenseTier = "nonexclusive" | "unlimited" | "exclusive";

export const DEFAULT_NONEXCLUSIVE_CENTS = 2499;

export type LicensableBeat = {
  priceCents: number;
  nonExclusivePriceCents?: number | null;
  exclusivePriceCents?: number | null;
};

export const TIER_META: Record<
  LicenseTier,
  { label: string; short: string; blurb: string; bullets: string[] }
> = {
  nonexclusive: {
    label: "Non-Exclusive",
    short: "Non-Exclusive",
    blurb: "Release and monetize one song. The beat stays available to others.",
    bullets: [
      "Tagged-free MP3 for one song",
      "Streaming, social and live use",
      "Producer credit and splits required",
    ],
  },
  unlimited: {
    label: "Unlimited",
    short: "Unlimited",
    blurb: "Unlimited songs, unlimited streams, you keep 100% of your masters.",
    bullets: [
      "Unlimited MP3 · unlimited songs",
      "Streams, sales and monetization",
      "Keep 100% of your master royalties",
    ],
  },
  exclusive: {
    label: "Exclusive Rights",
    short: "Exclusive",
    blurb: "The beat is taken off the store and licensed to you alone.",
    bullets: [
      "Beat removed from the catalog after purchase",
      "All non-exclusive rights, plus exclusivity",
      "Producer credit and splits still required",
    ],
  },
};

export const TIER_ORDER: LicenseTier[] = ["nonexclusive", "unlimited", "exclusive"];

/** Price in cents for a tier, or null when the tier is inquiry-only. */
export function tierPriceCents(beat: LicensableBeat, tier: LicenseTier): number | null {
  if (tier === "unlimited") return beat.priceCents || null;
  if (tier === "nonexclusive") {
    const v = beat.nonExclusivePriceCents;
    return typeof v === "number" && v > 0 ? v : DEFAULT_NONEXCLUSIVE_CENTS;
  }
  const x = beat.exclusivePriceCents;
  return typeof x === "number" && x > 0 ? x : null;
}

export function isLicenseTier(value: unknown): value is LicenseTier {
  return value === "nonexclusive" || value === "unlimited" || value === "exclusive";
}
