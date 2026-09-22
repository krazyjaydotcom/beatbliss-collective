/**
 * License tiers offered on the storefront.
 *
 * - Non-Exclusive MP3: the cheaper entry tier. Price comes from the beat when
 *   the producer has set one, otherwise the shared default below.
 * - Unlimited License (WAV+MP3): the existing $49.99 license, unchanged wording
 *   and terms.
 * - Unlimited w/ STEMs: $150 by default, or the per-beat price set in admin.
 */

export type LicenseTier = "nonexclusive" | "unlimited" | "trackout";

export const DEFAULT_NONEXCLUSIVE_CENTS = 2499;
export const DEFAULT_TRACKOUT_CENTS = 15000;

export type LicensableBeat = {
  priceCents: number;
  nonExclusivePriceCents?: number | null;
  trackoutPriceCents?: number | null;
  exclusivePriceCents?: number | null;
};

export const TIER_META: Record<
  LicenseTier,
  { label: string; short: string; blurb: string; bullets: string[] }
> = {
  nonexclusive: {
    label: "Non-Exclusive MP3",
    short: "MP3",
    blurb: "Sell physical units and perform the track at events for promotional purposes. Streaming rights are not included.",
    bullets: [
      "Tagged-free MP3 for one song",
      "Physical-unit sales permitted",
      "Promotional event performances permitted",
      "No streaming rights",
      "Producer credit and splits required",
    ],
  },
  unlimited: {
    label: "Unlimited License (WAV+MP3)",
    short: "Unlimited",
    blurb: "Unlimited songs, unlimited streams, you keep 100% of your masters.",
    bullets: [
      "Unlimited MP3 + WAV · unlimited songs",
      "Streams, sales and monetization",
      "Keep 100% of your master royalties",
    ],
  },
  trackout: {
    label: "Unlimited w/ STEMs",
    short: "Unlimited + STEMs",
    blurb: "Unlimited licensing plus the full song files broken out by instrument. STEMs may take up to 24 hours for delivery.",
    bullets: [
      "Individual WAV stems for each instrument",
      "Use with MP3 + WAV versions of the beat",
      "Full mixing and arrangement control",
      "STEMs may take up to 24 hours for delivery",
    ],
  },
};

export const TIER_ORDER: LicenseTier[] = ["nonexclusive", "unlimited", "trackout"];

/** Price in cents for a tier, or null when the tier is inquiry-only. */
export function tierPriceCents(beat: LicensableBeat, tier: LicenseTier): number | null {
  if (tier === "unlimited") return beat.priceCents || null;
  if (tier === "nonexclusive") {
    const v = beat.nonExclusivePriceCents;
    return typeof v === "number" && v > 0 ? v : DEFAULT_NONEXCLUSIVE_CENTS;
  }
  const v = beat.trackoutPriceCents;
  return typeof v === "number" && v > 0 ? v : DEFAULT_TRACKOUT_CENTS;
}

export function isLicenseTier(value: unknown): value is LicenseTier {
  return value === "nonexclusive" || value === "unlimited" || value === "trackout";
}
