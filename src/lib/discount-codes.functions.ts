import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Admin-only discount codes, stored as Stripe coupons + promotion codes.
 * Checkout sessions enable allow_promotion_codes so buyers can enter them.
 */
async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!data) throw new Error("Forbidden");
}

const envSchema = z.enum(["sandbox", "live"]);

export type DiscountCode = {
  id: string;
  code: string;
  active: boolean;
  percentOff: number | null;
  amountOffCents: number | null;
  timesRedeemed: number;
  maxRedemptions: number | null;
  expiresAt: number | null;
  created: number;
};

export const listDiscountCodes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { environment: "sandbox" | "live" }) => z.object({ environment: envSchema }).parse(d))
  .handler(async ({ data, context }): Promise<DiscountCode[]> => {
    await assertAdmin(context);
    const { createStripeClient } = await import("@/lib/stripe.server");
    const stripe = createStripeClient(data.environment);
    const res = await stripe.promotionCodes.list({ limit: 100, expand: ["data.promotion.coupon"] } as any);
    return res.data.map((p: any) => {
      const coupon = p.coupon ?? p.promotion?.coupon ?? {};
      return {
        id: p.id,
        code: p.code,
        active: p.active,
        percentOff: coupon.percent_off ?? null,
        amountOffCents: coupon.amount_off ?? null,
        timesRedeemed: p.times_redeemed ?? 0,
        maxRedemptions: p.max_redemptions ?? null,
        expiresAt: p.expires_at ?? null,
        created: p.created,
      };
    });
  });

export const createDiscountCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        environment: envSchema,
        code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,30}$/, "Use 3–30 letters, numbers, - or _"),
        kind: z.enum(["percent", "amount"]),
        value: z.number().positive(),
        maxRedemptions: z.number().int().positive().optional(),
        expiresAt: z.string().optional(),
        firstTimeOnly: z.boolean().optional(),
      })
      .refine((v) => v.kind !== "percent" || v.value <= 100, "Percent must be 1–100")
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: boolean; error?: string }> => {
    await assertAdmin(context);
    try {
      const { createStripeClient } = await import("@/lib/stripe.server");
      const stripe = createStripeClient(data.environment);
      const coupon = await stripe.coupons.create({
        name: data.code,
        duration: "once",
        ...(data.kind === "percent"
          ? { percent_off: data.value }
          : { amount_off: Math.round(data.value * 100), currency: "usd" }),
      });
      const expires = data.expiresAt ? Math.floor(new Date(data.expiresAt).getTime() / 1000) : undefined;
      await stripe.promotionCodes.create({
        promotion: { type: "coupon", coupon: coupon.id },
        code: data.code,
        ...(data.maxRedemptions ? { max_redemptions: data.maxRedemptions } : {}),
        ...(expires ? { expires_at: expires } : {}),
        ...(data.firstTimeOnly ? { restrictions: { first_time_transaction: true } } : {}),
      } as any);
      return { ok: true };
    } catch (err) {
      const { getStripeErrorMessage } = await import("@/lib/stripe.server");
      return { ok: false, error: getStripeErrorMessage(err) };
    }
  });

export const setDiscountCodeActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ environment: envSchema, id: z.string().regex(/^promo_[A-Za-z0-9]+$/), active: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { createStripeClient } = await import("@/lib/stripe.server");
    const stripe = createStripeClient(data.environment);
    await stripe.promotionCodes.update(data.id, { active: data.active });
    return { ok: true };
  });
