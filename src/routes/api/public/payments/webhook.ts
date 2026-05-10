import { createFileRoute } from "@tanstack/react-router";
import type Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import {
  createStripeClient,
  getWebhookSecret,
  tierFromLookupKey,
  type StripeEnv,
} from "@/lib/stripe.server";
import type { Database } from "@/integrations/supabase/types";

function getAdmin() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient<Database>(url, key, { auth: { persistSession: false } });
}

async function applySubscription(
  env: StripeEnv,
  sub: Stripe.Subscription,
) {
  const stripe = createStripeClient(env);
  const admin = getAdmin();

  let userId: string | undefined = sub.metadata?.userId;
  if (!userId) {
    const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
    const customer = await stripe.customers.retrieve(customerId);
    if (!customer.deleted) {
      userId = customer.metadata?.userId;
    }
  }

  if (!userId) {
    console.warn("[webhook] subscription has no userId metadata", sub.id);
    return;
  }

  const item = sub.items.data[0];
  const priceId = item?.price?.id;
  let lookupKey = item?.price?.lookup_key ?? null;
  if (!lookupKey && priceId) {
    const price = await stripe.prices.retrieve(priceId);
    lookupKey = price.lookup_key ?? null;
  }
  const tier = sub.status === "canceled" || sub.status === "incomplete_expired" || sub.status === "unpaid"
    ? "none"
    : tierFromLookupKey(lookupKey);

  // current_period_end lives on the subscription item in newer Stripe API versions
  const periodEndUnix =
    (item as unknown as { current_period_end?: number })?.current_period_end ??
    (sub as unknown as { current_period_end?: number })?.current_period_end;
  const periodEnd = periodEndUnix ? new Date(periodEndUnix * 1000).toISOString() : null;

  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;

  await admin
    .from("profiles")
    .update({
      stripe_customer_id: customerId,
      subscription_tier: tier,
      subscription_status: sub.status,
      current_period_end: periodEnd,
    })
    .eq("id", userId);
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const envParam = url.searchParams.get("env");
        const env: StripeEnv = envParam === "live" ? "live" : "sandbox";

        const signature = request.headers.get("stripe-signature");
        if (!signature) return new Response("Missing signature", { status: 400 });

        const body = await request.text();
        const stripe = createStripeClient(env);

        let event: Stripe.Event;
        try {
          event = await stripe.webhooks.constructEventAsync(
            body,
            signature,
            getWebhookSecret(env),
          );
        } catch (err) {
          console.error("[webhook] signature verification failed", err);
          return new Response("Invalid signature", { status: 401 });
        }

        try {
          switch (event.type) {
            case "checkout.session.completed": {
              const session = event.data.object as Stripe.Checkout.Session;
              if (session.mode === "subscription" && session.subscription) {
                const subId = typeof session.subscription === "string"
                  ? session.subscription
                  : session.subscription.id;
                const sub = await stripe.subscriptions.retrieve(subId);
                // Ensure userId metadata is on the subscription
                if (!sub.metadata?.userId && session.metadata?.userId) {
                  await stripe.subscriptions.update(subId, {
                    metadata: { ...sub.metadata, userId: session.metadata.userId },
                  });
                  sub.metadata = { ...sub.metadata, userId: session.metadata.userId };
                }
                await applySubscription(env, sub);
              }
              break;
            }
            case "customer.subscription.created":
            case "customer.subscription.updated":
            case "customer.subscription.deleted": {
              await applySubscription(env, event.data.object as Stripe.Subscription);
              break;
            }
            default:
              break;
          }
        } catch (err) {
          console.error("[webhook] handler error", err);
          return new Response("Handler error", { status: 500 });
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
