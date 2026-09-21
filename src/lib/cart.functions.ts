import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createStripeClient, type StripeEnv } from "@/lib/stripe.server";
import { DEFAULT_NONEXCLUSIVE_CENTS, TIER_META, type LicenseTier } from "@/lib/licensing";

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
  const x = beat.exclusive_price_cents;
  return typeof x === "number" && x > 0 ? x : null;
}

export const createCartCheckoutSession = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      items: { beatId: string; tier: LicenseTier }[];
      email?: string;
      environment: StripeEnv;
      returnUrl: string;
    }) =>
      z
        .object({
          items: z
            .array(
              z.object({
                beatId: z.string().uuid(),
                tier: z.enum(["nonexclusive", "unlimited", "exclusive"]),
              }),
            )
            .min(1)
            .max(20),
          email: z.string().trim().email().max(255).optional().or(z.literal("")),
          environment: z.enum(["sandbox", "live"]),
          returnUrl: z.string().max(2048),
        })
        .parse(input),
  )
  .handler(
    async ({ data }): Promise<{ clientSecret: string | null; error: string | null }> => {
      const sb = adminClient() as any;
      const email = data.email ? data.email.toLowerCase() : null;
      const ids = Array.from(new Set(data.items.map((i) => i.beatId)));


    const { data: rows } = await sb
      .from("beats")
      .select(
        "id,title,landing_slug,cover_url,price_cents,nonexclusive_price_cents,exclusive_price_cents,is_active,landing_visibility",
      )
      .in("id", ids);

    const byId = new Map<string, Record<string, any>>(
      ((rows ?? []) as Record<string, any>[]).map((b) => [b.id as string, b]),
    );

    const lineItems: any[] = [];
    const orders: { beat_id: string; amount_cents: number }[] = [];

    for (const item of data.items) {
      const beat = byId.get(item.beatId);
      if (!beat || !beat.is_active) return { url: null, error: "One of these beats is no longer available." };
      const amount = resolvePrice(beat, item.tier);
      if (!amount || amount < 50) {
        return {
          url: null,
          error: `${beat.title}: the ${TIER_META[item.tier].label} price isn't set up yet.`,
        };
      }
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
      orders.push({ beat_id: beat.id, amount_cents: amount });
    }

    // Record intent (best-effort). Never block checkout on this.
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

    try {
      const stripe = createStripeClient(data.environment);
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: lineItems,
        customer_email: email,
        success_url: data.successUrl,
        cancel_url: data.cancelUrl,
        payment_intent_data: { description: `MYBEATCATALOG — ${lineItems.length} license(s)` },
        metadata: {
          source: "beat_cart",
          buyer_email: email,
          beat_ids: data.items.map((i) => i.beatId).join(","),
          tiers: data.items.map((i) => i.tier).join(","),
          item_count: String(data.items.length),
        },
      });
      return { url: session.url ?? null, error: null };
    } catch (err) {
      return {
        url: null,
        error: err instanceof Error ? err.message : "Checkout is unavailable right now.",
      };
    }
  });
