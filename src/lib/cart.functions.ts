import { createServerFn } from "@tanstack/react-start";
import type Stripe from "stripe";
import { z } from "zod";
import { createStripeClient, getStripeErrorMessage, type StripeEnv } from "@/lib/stripe.server";
import {
  discountEligibleAmounts,
  isFreePromoOrder,
  isSupportedBeatCoupon,
  sameCheckoutItems,
} from "@/lib/checkout-pricing";
import {
  DEFAULT_NONEXCLUSIVE_CENTS,
  DEFAULT_TRACKOUT_CENTS,
  TIER_META,
  type LicenseTier,
} from "@/lib/licensing";

/**
 * Multi-beat checkout. Prices are ALWAYS resolved server-side from the beat
 * record — the browser only says which beat and which license tier.
 */

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
      name?: string;
      action?: "checkout" | "quote" | "claim";
      requestId?: string;
      environment: StripeEnv;
      discountCode?: string;
      returnUrl: string;
      attribution?: {
        source?: string | null;
        medium?: string | null;
        campaign?: string | null;
        content?: string | null;
        sessionKey?: string | null;
      };
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
          name: z.string().trim().min(1).max(120).optional(),
          action: z.enum(["checkout", "quote", "claim"]).default("checkout"),
          requestId: z.string().uuid().optional(),
          environment: z.enum(["sandbox", "live"]),
          discountCode: z
            .string()
            .trim()
            .toUpperCase()
            .regex(/^[A-Z0-9_-]{3,30}$/)
            .optional()
            .or(z.literal("")),
          returnUrl: z.string().max(2048),
          attribution: z
            .object({
              source: z.string().max(100).nullable().optional(),
              medium: z.string().max(100).nullable().optional(),
              campaign: z.string().max(160).nullable().optional(),
              content: z.string().max(160).nullable().optional(),
              sessionKey: z.string().max(64).nullable().optional(),
            })
            .optional(),
        })
        .parse(input),
  )
  .handler(
    async ({
      data,
    }): Promise<{
      clientSecret: string | null;
      error: string | null;
      discountNote?: string | null;
      freeOrder?: boolean;
      totalCents?: number;
      originalTotalCents?: number;
      downloads?: { title: string; label: string; url: string }[];
      deliveryPending?: boolean;
    }> => {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const sb = supabaseAdmin as any;
      const email = data.email ? data.email.toLowerCase() : null;
      const requestData = {
        items: data.items,
        email,
        name: data.name ?? null,
        code: data.discountCode ?? "",
      };
      if (data.action === "claim") {
        if (!email || !data.name || !data.requestId || !data.discountCode)
          return {
            clientSecret: null,
            error: "Enter your name, email and promo code to claim your licenses.",
          };
        const { data: existing, error: readError } = await sb
          .from("beat_free_claims")
          .select("environment,request_data,session_data")
          .eq("request_id", data.requestId)
          .maybeSingle();
        if (readError)
          return { clientSecret: null, error: "Couldn't check your claim. Please retry." };
        if (existing) {
          if (
            existing.environment !== data.environment ||
            !sameCheckoutItems(existing.request_data.items, requestData.items) ||
            existing.request_data.email !== email ||
            existing.request_data.name !== data.name ||
            existing.request_data.code !== data.discountCode
          )
            return { clientSecret: null, error: "Claim details do not match. Start a new claim." };
          const { finishFreeClaim } = await import("@/lib/free-claim.server");
          return finishFreeClaim(
            existing.session_data as Stripe.Checkout.Session,
            createStripeClient(data.environment),
            sb,
            data.environment,
          );
        }
      }
      const ids = Array.from(new Set(data.items.map((i) => i.beatId)));
      if (ids.length !== data.items.length) {
        return { clientSecret: null, error: "Choose one license per beat before checkout." };
      }

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
      let amounts: number[] = [];
      const lineMeta: { beat: Record<string, any>; tier: LicenseTier }[] = [];
      const orders: { beat_id: string; amount_cents: number }[] = [];

      for (const item of data.items) {
        const beat = byId.get(item.beatId);
        if (!beat || !beat.is_active || beat.landing_visibility === "private")
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
      }

      // Validate every promo here. Nonzero all-tier discounts remain Stripe-applied;
      // zero-total claims and tier-limited discounts use server-calculated amounts.
      let validatedPromo: any = null;
      let stripeDiscount: { promotion_code: string } | null = null;
      let restrictedPromoId: string | null = null;
      const originalTotalCents = amounts.reduce((sum, amount) => sum + amount, 0);
      let expectedFinalAmounts: number[] | null = null;
      let discountNote: string | null = null;
      if (data.discountCode) {
        try {
          const stripe = createStripeClient(data.environment);
          const res: any = await stripe.promotionCodes.list({
            code: data.discountCode,
            active: true,
            limit: 1,
            expand: ["data.promotion.coupon"],
          } as any);
          const promo = res.data[0];
          const coupon = promo?.coupon ?? promo?.promotion?.coupon;
          if (
            !promo ||
            !coupon ||
            coupon.valid === false ||
            (promo.expires_at && promo.expires_at * 1000 < Date.now())
          ) {
            return { clientSecret: null, error: "That discount code isn't valid or has expired." };
          }
          const tiers = coupon.metadata?.tiers ? String(coupon.metadata.tiers).split(",") : null;
          validatedPromo = promo;
          if (!isSupportedBeatCoupon(coupon))
            return {
              clientSecret: null,
              error: "This code isn't available for these beat licenses.",
            };
          {
            const { data: usage, error: usageError } = await sb.rpc("beat_promo_redemption_count", {
              p_environment: data.environment,
              p_promo_id: promo.id,
              p_legacy_count: Number(promo.metadata?.tier_redemptions ?? 0),
            });
            if (usageError) throw usageError;
            const used = Number(usage) + (promo.times_redeemed ?? 0);
            if (promo.max_redemptions && used >= promo.max_redemptions) {
              return { clientSecret: null, error: "That discount code has been used up." };
            }
            const idx = lineMeta
              .map((m, i) => (!tiers || tiers.includes(m.tier) ? i : -1))
              .filter((i) => i >= 0);
            if (!idx.length) {
              const names = (tiers ?? [])
                .map((t) => TIER_META[t as LicenseTier]?.label ?? t)
                .join(", ");
              return {
                clientSecret: null,
                error: `${data.discountCode} only works on ${names} licenses, and none are in your cart.`,
              };
            }
            const matchTotal = idx.reduce((n, i) => n + (amounts[i] ?? 0), 0);
            if (coupon.currency && coupon.currency !== "usd") {
              return { clientSecret: null, error: "That discount code uses a different currency." };
            }
            if (
              promo.restrictions?.minimum_amount &&
              matchTotal < promo.restrictions.minimum_amount
            ) {
              return {
                clientSecret: null,
                error: "Your eligible licenses don't meet this code's minimum purchase amount.",
              };
            }
            if (promo.restrictions?.first_time_transaction && (email || data.action !== "quote")) {
              if (!email)
                return {
                  clientSecret: null,
                  error: "Enter your email before using a first-purchase discount.",
                };
              const { data: previous, error: previousError } = await sb
                .from("purchase_licenses")
                .select("id")
                .eq("email", email)
                .eq("payment_environment", data.environment)
                .limit(1);
              if (previousError) throw previousError;
              const customers = await stripe.customers.list({ email, limit: 100 });
              if (previous?.length)
                return { clientSecret: null, error: "This code is only for first-time buyers." };
              for (const customer of customers.data) {
                const sessions = await stripe.checkout.sessions.list({
                  customer: customer.id,
                  limit: 100,
                });
                if (sessions.data.some((s) => s.status === "complete")) {
                  return { clientSecret: null, error: "This code is only for first-time buyers." };
                }
              }
            }
            if (promo.customer && (email || data.action !== "quote")) {
              const customer = await stripe.customers.retrieve(
                typeof promo.customer === "string" ? promo.customer : promo.customer.id,
              );
              if (customer.deleted || !email || customer.email?.toLowerCase() !== email) {
                return {
                  clientSecret: null,
                  error: "That discount code is reserved for a different buyer.",
                };
              }
            }
            const finalAmounts = discountEligibleAmounts(amounts, idx, coupon);
            if (!tiers && !isFreePromoOrder(finalAmounts, true)) {
              stripeDiscount = { promotion_code: promo.id };
              expectedFinalAmounts = finalAmounts;
            } else {
              amounts = finalAmounts;
              restrictedPromoId = promo.id;
            }
            discountNote = `${data.discountCode} applied to ${idx.length} matching license${idx.length > 1 ? "s" : ""}.`;
          }
        } catch {
          return {
            clientSecret: null,
            error: "Couldn't check that discount code. Please try again.",
          };
        }
      }

      const finalAmounts = expectedFinalAmounts ?? amounts;
      const freeOrder = isFreePromoOrder(finalAmounts, !!validatedPromo);
      if (data.action === "quote")
        return {
          clientSecret: null,
          error: null,
          freeOrder,
          originalTotalCents,
          totalCents: finalAmounts.reduce((a, b) => a + b, 0),
          discountNote,
        };
      if (freeOrder) {
        // Nothing is recorded until the buyer explicitly supplies identity and claims.
        if (data.action !== "claim")
          return {
            clientSecret: null,
            error: null,
            freeOrder,
            originalTotalCents,
            totalCents: 0,
            discountNote,
          };
        const session = {
          id: `free_${data.requestId}`,
          amount_total: 0,
          payment_status: "no_payment_required",
          customer_details: { email, name: data.name },
          metadata: {
            source: "beat_cart",
            buyer_email: email,
            discount_promo_id: validatedPromo.id,
            discount_code: data.discountCode,
            beat_ids: data.items.map((i) => i.beatId).join(","),
            tiers: data.items.map((i) => i.tier).join(","),
            utm_source: data.attribution?.source ?? "",
            utm_medium: data.attribution?.medium ?? "",
            utm_campaign: data.attribution?.campaign ?? "",
            utm_content: data.attribution?.content ?? "",
            attribution_session: data.attribution?.sessionKey ?? "",
          },
        };
        const { data: saved, error: reserveError } = await sb.rpc("reserve_beat_free_claim", {
          p_request_id: data.requestId,
          p_environment: data.environment,
          p_promo_id: validatedPromo.id,
          p_email: email,
          p_request: requestData,
          p_session: session,
          p_max: validatedPromo.max_redemptions ?? null,
          p_stripe_used: validatedPromo.times_redeemed ?? 0,
          p_legacy: Number(validatedPromo.metadata?.tier_redemptions ?? 0),
          p_first_time: !!validatedPromo.restrictions?.first_time_transaction,
        });
        if (reserveError)
          return {
            clientSecret: null,
            error: reserveError.message || "Couldn't reserve your claim. Please retry.",
          };
        const { finishFreeClaim } = await import("@/lib/free-claim.server");
        return finishFreeClaim(
          saved as Stripe.Checkout.Session,
          createStripeClient(data.environment),
          sb,
          data.environment,
        );
      }
      if (data.action === "claim")
        return {
          clientSecret: null,
          error: "This order has a remaining balance. Continue with secure payment.",
        };

      lineMeta.forEach(({ beat, tier }, i) => {
        lineItems.push({
          price_data: {
            currency: "usd",
            unit_amount: amounts[i],
            product_data: {
              name: `${beat.title} — ${TIER_META[tier].label} License`,
              metadata: { beat_id: beat.id, license_tier: tier },
              ...(beat.cover_url ? { images: [beat.cover_url] } : {}),
            },
          },
          quantity: 1,
        });
        orders.push({ beat_id: beat.id, amount_cents: expectedFinalAmounts?.[i] ?? amounts[i] });
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
        // Payment-mode $0 sessions skip card collection automatically. Stripe
        // only accepts payment_method_collection for recurring checkout.
        name_collection: { individual: { enabled: true, optional: false } },
        ...(stripeDiscount ? { discounts: [stripeDiscount] } : { allow_promotion_codes: true }),
        ...(email ? { customer_email: email } : {}),
        payment_intent_data: {
          description: `MYBEATCATALOG — ${lineItems.length} license(s)`,
        },
        metadata: {
          source: "beat_cart",
          ...(restrictedPromoId
            ? { discount_promo_id: restrictedPromoId, discount_code: data.discountCode ?? "" }
            : {}),
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
          session = await stripe.checkout.sessions.create({
            ...base,
            redirect_on_completion: "never",
          });
        } catch {
          session = await stripe.checkout.sessions.create({ ...base, return_url: data.returnUrl });
        }
        try {
          await sb.from("purchase_funnel_events").insert(
            data.items.map((item) => ({
              event_type: "checkout_started",
              beat_id: item.beatId,
              license_tier: item.tier,
              utm_source: data.attribution?.source ?? null,
              utm_medium: data.attribution?.medium ?? null,
              utm_campaign: data.attribution?.campaign ?? null,
              utm_content: data.attribution?.content ?? null,
              session_key: data.attribution?.sessionKey ?? null,
              stripe_session_id: session.id,
              payment_environment: data.environment,
            })),
          );
        } catch {
          /* analytics never blocks checkout */
        }
        return { clientSecret: session.client_secret ?? null, error: null, discountNote };
      } catch (err) {
        return {
          clientSecret: null,
          error: getStripeErrorMessage(err),
        };
      }
    },
  );
