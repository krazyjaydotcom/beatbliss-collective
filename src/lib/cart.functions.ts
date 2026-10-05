import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createStripeClient, type StripeEnv } from "@/lib/stripe.server";
import { DEFAULT_NONEXCLUSIVE_CENTS, DEFAULT_TRACKOUT_CENTS, TIER_META, type LicenseTier } from "@/lib/licensing";

/**
 * Multi-beat checkout. Prices are ALWAYS resolved server-side from the beat
 * record — the browser only says which beat and which license tier.
 */

let _admin: ReturnType<typeof createClient> | null = null;
function adminClient() {
  if (!_admin) {
    _admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  }
  return _admin;
}

function resolvePrice(beat: Record<string, any>, tier: LicenseTier): number | null {
  if (tier === "unlimited") return beat.price_cents ?? null;
  if (tier === "nonexclusive") {
    const v = beat.nonexclusive_price_cents;
    return typeof v === "number" && v > 0 ? v : DEFAULT_NONEXCLUSIVE_CENTS;
  }
  const v = beat.trackout_price_cents;
  return typeof v === "number" && v > 0 ? v : DEFAULT_TRACKOUT_CENTS;
}

export const createCartCheckoutSession = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      items: { beatId: string; tier: LicenseTier }[];
      email?: string;
      environment: StripeEnv;
      discountCode?: string;
      returnUrl: string;
      attribution?: { source?: string | null; medium?: string | null; campaign?: string | null; content?: string | null; sessionKey?: string | null };
    }) =>
      z
        .object({
          items: z
            .array(
              z.object({
                beatId: z.string().uuid(),
                tier: z.enum(["nonexclusive", "unlimited", "trackout"]),
              }),
            )
            .min(1)
            .max(20),
          email: z.string().trim().email().max(255).optional().or(z.literal("")),
          environment: z.enum(["sandbox", "live"]),
          discountCode: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,30}$/).optional().or(z.literal("")),
          returnUrl: z.string().max(2048),
          attribution: z.object({
            source: z.string().max(100).nullable().optional(),
            medium: z.string().max(100).nullable().optional(),
            campaign: z.string().max(160).nullable().optional(),
            content: z.string().max(160).nullable().optional(),
            sessionKey: z.string().max(64).nullable().optional(),
          }).optional(),
        })
        .parse(input),
  )
  .handler(
    async ({ data }): Promise<{ clientSecret: string | null; error: string | null; discountNote?: string | null }> => {
      const sb = adminClient() as any;
      const email = data.email ? data.email.toLowerCase() : null;
      const ids = Array.from(new Set(data.items.map((i) => i.beatId)));

      const { data: rows } = await sb
        .from("beats")
        .select(
          "id,title,landing_slug,cover_url,price_cents,nonexclusive_price_cents,trackout_price_cents,exclusive_price_cents,is_active,landing_visibility",
        )
        .in("id", ids);

      const byId = new Map<string, Record<string, any>>(
        ((rows ?? []) as Record<string, any>[]).map((b) => [b.id as string, b]),
      );

      const lineItems: any[] = [];
      const amounts: number[] = [];
      const lineMeta: { beat: Record<string, any>; tier: LicenseTier }[] = [];
      const orders: { beat_id: string; amount_cents: number }[] = [];

      for (const item of data.items) {
        const beat = byId.get(item.beatId);
        if (!beat || !beat.is_active)
          return { clientSecret: null, error: "One of these beats is no longer available." };
        const amount = resolvePrice(beat, item.tier);
        if (!amount || amount < 50) {
          return {
            clientSecret: null,
            error: `${beat.title}: the ${TIER_META[item.tier].label} price isn't set up yet.`,
          };
        }
        amounts.push(amount);
        lineMeta.push({ beat, tier: item.tier });
        continue;
        lineItems.push({
          price_data: {
            currency: "usd",
            unit_amount: amount,
            product_data: {
              name: `${beat.title} — ${TIER_META[item.tier].label} License`,
              ...(beat.cover_url ? { images: [beat.cover_url] } : {}),
            },
          },
          quantity: 1,
        });
      }

      // Discount code handling. Codes for every license go straight to Stripe;
      // license-limited codes are applied here, only to the matching items.
      let stripeDiscount: { promotion_code: string } | null = null;
      let restrictedPromoId: string | null = null;
      let discountNote: string | null = null;
      if (data.discountCode) {
        try {
          const stripe = createStripeClient(data.environment);
          const res: any = await stripe.promotionCodes.list({ code: data.discountCode, active: true, limit: 1, expand: ["data.promotion.coupon"] } as any);
          const promo = res.data[0];
          const coupon = promo?.coupon ?? promo?.promotion?.coupon;
          if (!promo || !coupon || coupon.valid === false || (promo.expires_at && promo.expires_at * 1000 < Date.now())) {
            return { clientSecret: null, error: "That discount code isn't valid or has expired." };
          }
          const tiers = coupon.metadata?.tiers ? String(coupon.metadata.tiers).split(",") : null;
          if (!tiers) {
            stripeDiscount = { promotion_code: promo.id };
            discountNote = `${data.discountCode} applied to your whole order.`;
          } else {
            const used = Number(promo.metadata?.tier_redemptions ?? 0);
            if (promo.max_redemptions && used >= promo.max_redemptions) {
              return { clientSecret: null, error: "That discount code has been used up." };
            }
            const idx = lineMeta.map((m, i) => (tiers.includes(m.tier) ? i : -1)).filter((i) => i >= 0);
            if (!idx.length) {
              const names = tiers.map((t) => TIER_META[t as LicenseTier]?.label ?? t).join(", ");
              return { clientSecret: null, error: `${data.discountCode} only works on ${names} licenses, and none are in your cart.` };
            }
            const matchTotal = idx.reduce((n, i) => n + amounts[i], 0);
            let remainingOff = coupon.amount_off ?? 0;
            idx.forEach((i, k) => {
              let off: number;
              if (coupon.percent_off) off = Math.round((amounts[i] * coupon.percent_off) / 100);
              else off = k === idx.length - 1 ? remainingOff : Math.round(((coupon.amount_off ?? 0) * amounts[i]) / matchTotal);
              off = Math.min(off, amounts[i] - 50);
              remainingOff -= off;
              amounts[i] -= Math.max(0, off);
            });
            restrictedPromoId = promo.id;
            discountNote = `${data.discountCode} applied to ${idx.length} matching license${idx.length > 1 ? "s" : ""}.`;
          }
        } catch {
          return { clientSecret: null, error: "Couldn't check that discount code. Please try again." };
        }
      }

      lineMeta.forEach(({ beat, tier }, i) => {
        lineItems.push({
          price_data: {
            currency: "usd",
            unit_amount: amounts[i],
            product_data: {
              name: `${beat.title} — ${TIER_META[tier].label} License`,
              ...(beat.cover_url ? { images: [beat.cover_url] } : {}),
            },
          },
          quantity: 1,
        });
        orders.push({ beat_id: beat.id, amount_cents: amounts[i] });
      });

      // Record intent (best-effort) only when we already know the buyer's
      // email. Otherwise the webhook creates the order from Stripe's own
      // customer details after payment. Never block checkout on this.
      if (email) {
        try {
          await sb.from("lease_orders").insert(
            orders.map((o) => ({
              email,
              beat_id: o.beat_id,
              amount_cents: o.amount_cents,
              used_first_time_discount: false,
            })),
          );
        } catch {
          /* ignore */
        }
      }

      const base = {
        mode: "payment" as const,
        line_items: lineItems,
        ui_mode: "embedded_page" as const,
        ...(stripeDiscount ? { discounts: [stripeDiscount] } : { allow_promotion_codes: true }),
        ...(email ? { customer_email: email } : {}),
        payment_intent_data: {
          description: `MYBEATCATALOG — ${lineItems.length} license(s)`,
        },
        metadata: {
          source: "beat_cart",
          ...(restrictedPromoId ? { discount_promo_id: restrictedPromoId, discount_code: data.discountCode! } : {}),
          ...(email ? { buyer_email: email } : {}),
          beat_ids: data.items.map((i) => i.beatId).join(","),
          tiers: data.items.map((i) => i.tier).join(","),
          amounts: orders.map((o) => o.amount_cents).join(","),
          item_count: String(data.items.length),
          utm_source: data.attribution?.source ?? "",
          utm_medium: data.attribution?.medium ?? "",
          utm_campaign: data.attribution?.campaign ?? "",
          utm_content: data.attribution?.content ?? "",
          attribution_session: data.attribution?.sessionKey ?? "",
        },
      };

      try {
        const stripe = createStripeClient(data.environment);
        let session;
        try {
          session = await stripe.checkout.sessions.create({ ...base, redirect_on_completion: "never" });
        } catch {
          session = await stripe.checkout.sessions.create({ ...base, return_url: data.returnUrl });
        }
        try {
          await sb.from("purchase_funnel_events").insert(data.items.map((item) => ({ event_type: "checkout_started", beat_id: item.beatId, license_tier: item.tier, utm_source: data.attribution?.source ?? null, utm_medium: data.attribution?.medium ?? null, utm_campaign: data.attribution?.campaign ?? null, utm_content: data.attribution?.content ?? null, session_key: data.attribution?.sessionKey ?? null, stripe_session_id: session.id, payment_environment: data.environment })));
        } catch { /* analytics never blocks checkout */ }
        return { clientSecret: session.client_secret ?? null, error: null, discountNote };
      } catch (err) {
        return {
          clientSecret: null,
          error: err instanceof Error ? err.message : "Checkout is unavailable right now.",
        };
      }

    },
  );

