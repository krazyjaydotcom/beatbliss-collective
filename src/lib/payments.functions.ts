import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { type StripeEnv, createStripeClient } from "@/lib/stripe.server";

type PlanTier = "artist" | "label" | "none";

function tierForPlan(priceId: string): PlanTier {
  if (priceId.startsWith("artist_")) return "artist";
  if (priceId.startsWith("label_")) return "label";
  return "none";
}

async function resolveCheckoutLineItem(stripe: ReturnType<typeof createStripeClient>, priceId: string) {
  if (priceId === "artist_monthly" || priceId === "artist_monthly_v2") {
    return {
      lineItem: {
        price_data: {
          currency: "usd",
          unit_amount: 4999,
          recurring: { interval: "month" },
          product_data: { name: "MYBEATCATALOG Catalog Membership" },
        },
        quantity: 1,
      },
      isRecurring: true,
    };
  }

  const prices = await stripe.prices.list({ lookup_keys: [priceId] });
  if (!prices.data.length) {
    throw new Error(`Plan "${priceId}" is not configured in Stripe yet. Add a Price with this lookup_key in your Stripe dashboard.`);
  }
  const stripePrice = prices.data[0];
  return {
    lineItem: { price: stripePrice.id, quantity: 1 },
    isRecurring: stripePrice.type === "recurring",
  };
}

async function validateBeatClaimForCheckout(params: { token?: string; email: string }) {
  if (!params.token) return null;

  const { data, error } = await (supabaseAdmin as any)
    .from("beat_claims")
    .select("id, email, expires_at, purchased_at")
    .eq("token", params.token)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("This private offer link is not valid.");
  if (String(data.email).toLowerCase() !== params.email.trim().toLowerCase()) {
    throw new Error("This private offer belongs to a different email address.");
  }
  if (data.purchased_at) {
    throw new Error("This private offer has already been used.");
  }
  if (new Date(data.expires_at).getTime() <= Date.now()) {
    throw new Error("This private offer has expired.");
  }

  return data;
}

async function resolveOrCreateCustomer(
  stripe: ReturnType<typeof createStripeClient>,
  options: { email?: string; userId?: string },
): Promise<string> {
  if (options.userId && !/^[a-zA-Z0-9_-]+$/.test(options.userId)) {
    throw new Error("Invalid userId");
  }
  if (options.userId) {
    const found = await stripe.customers.search({
      query: `metadata['userId']:'${options.userId}'`,
      limit: 1,
    });
    if (found.data.length) return found.data[0].id;
  }
  if (options.email) {
    const existing = await stripe.customers.list({ email: options.email, limit: 1 });
    if (existing.data.length) {
      const customer = existing.data[0];
      if (options.userId && customer.metadata?.userId !== options.userId) {
        await stripe.customers.update(customer.id, {
          metadata: { ...customer.metadata, userId: options.userId },
        });
      }
      return customer.id;
    }
  }
  const created = await stripe.customers.create({
    ...(options.email && { email: options.email }),
    ...(options.userId && { metadata: { userId: options.userId } }),
  });
  return created.id;
}

export const createCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    priceId: string;
    returnUrl: string;
    environment: StripeEnv;
  }) => {
    if (!/^[a-zA-Z0-9_-]+$/.test(data.priceId)) throw new Error("Invalid priceId");
    if (data.environment !== "sandbox" && data.environment !== "live") {
      throw new Error("Invalid environment");
    }
    return data;
  })
  .handler(async ({ data, context }): Promise<{ clientSecret: string | null; error: string | null }> => {
    try {
      const { supabase, userId, claims } = context;
      const email = (claims.email as string | undefined) ?? undefined;

      const stripe = createStripeClient(data.environment);
      const { lineItem, isRecurring } = await resolveCheckoutLineItem(stripe, data.priceId);
      const tier = tierForPlan(data.priceId);

      const customerId = await resolveOrCreateCustomer(stripe, { email, userId });

      await supabase
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("id", userId);

      const metadata = { userId, planId: data.priceId, tier };
      const session = await stripe.checkout.sessions.create({
        line_items: [lineItem as any],
        mode: isRecurring ? "subscription" : "payment",
        ui_mode: "embedded_page",
        return_url: data.returnUrl,
        customer: customerId,
        metadata,
        ...(isRecurring && { subscription_data: { metadata } }),
      });

      return { clientSecret: session.client_secret ?? null, error: null };
    } catch (err) {
      console.error("createCheckoutSession failed:", err);
      const message = err instanceof Error ? err.message : "Unknown error";
      return { clientSecret: null, error: message };
    }
  });

export const createPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { returnUrl: string; environment: StripeEnv }) => {
    if (data.environment !== "sandbox" && data.environment !== "live") {
      throw new Error("Invalid environment");
    }
    return data;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", userId)
      .maybeSingle();

    if (!profile?.stripe_customer_id) {
      throw new Error("No billing account found. Subscribe first.");
    }

    const stripe = createStripeClient(data.environment);
    const portal = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: data.returnUrl,
    });
    return portal.url;
  });

export const createGuestCheckoutSession = createServerFn({ method: "POST" })
  .inputValidator((input: { priceId: string; email: string; returnUrl: string; environment: StripeEnv; claimToken?: string }) =>
    z
      .object({
        priceId: z.string().regex(/^[a-zA-Z0-9_-]+$/).max(64),
        email: z.string().email().max(254),
        returnUrl: z.string().url().max(2048),
        environment: z.enum(["sandbox", "live"]),
        claimToken: z.string().regex(/^[a-z0-9-]{6,32}$/).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<{ clientSecret: string | null; error: string | null }> => {
    try {
      const email = data.email.trim().toLowerCase();
      await validateBeatClaimForCheckout({ token: data.claimToken, email });

      const stripe = createStripeClient(data.environment);
      const { lineItem, isRecurring } = await resolveCheckoutLineItem(stripe, data.priceId);
      const tier = tierForPlan(data.priceId);

      const existing = await stripe.customers.list({ email, limit: 1 });
      const customerId = existing.data.length
        ? existing.data[0].id
        : (await stripe.customers.create({ email })).id;

      const metadata: Record<string, string> = {
        planId: data.priceId,
        tier,
        ...(data.claimToken ? { beatClaimToken: data.claimToken } : {}),
      };

      const session = await stripe.checkout.sessions.create({
        line_items: [lineItem as any],
        mode: isRecurring ? "subscription" : "payment",
        ui_mode: "embedded_page",
        return_url: data.returnUrl,
        customer: customerId,
        customer_update: { address: "auto" },
        metadata,
        ...(isRecurring && { subscription_data: { metadata } }),
      });

      return { clientSecret: session.client_secret ?? null, error: null };
    } catch (err) {
      console.error("createGuestCheckoutSession failed:", err);
      return { clientSecret: null, error: err instanceof Error ? err.message : "Unknown error" };
    }
  });