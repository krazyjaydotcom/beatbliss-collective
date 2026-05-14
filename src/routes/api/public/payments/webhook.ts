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
import { issueInviteAndEmail } from "@/lib/invites.server";

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

const CREDITS_PER_TIER: Record<string, number> = { artist: 10, label: 25 };

async function grantMonthlyCredits(
  env: StripeEnv,
  invoice: Stripe.Invoice,
) {
  const stripe = createStripeClient(env);
  const admin = getAdmin();

  // Only grant for subscription invoices that were actually paid
  const subId = (invoice as unknown as { subscription?: string | Stripe.Subscription }).subscription;
  if (!subId || invoice.status !== "paid") return;
  const subscriptionId = typeof subId === "string" ? subId : subId.id;

  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  let userId: string | undefined = sub.metadata?.userId;
  if (!userId) {
    const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
    const customer = await stripe.customers.retrieve(customerId);
    if (!customer.deleted) userId = customer.metadata?.userId;
  }
  if (!userId) return;

  const item = sub.items.data[0];
  let lookupKey = item?.price?.lookup_key ?? null;
  if (!lookupKey && item?.price?.id) {
    const price = await stripe.prices.retrieve(item.price.id);
    lookupKey = price.lookup_key ?? null;
  }
  const tier = tierFromLookupKey(lookupKey);
  const credits = CREDITS_PER_TIER[tier];
  if (!credits) return;

  // Idempotency: only grant once per invoice
  const description = `Subscription credits (${tier}) · invoice ${invoice.id}`;
  const { data: existing } = await admin
    .from("transactions")
    .select("id")
    .eq("user_id", userId)
    .eq("description", description)
    .limit(1)
    .maybeSingle();
  if (existing) return;

  const { data: profile } = await admin
    .from("profiles")
    .select("credits_balance")
    .eq("id", userId)
    .maybeSingle();
  const newBalance = (profile?.credits_balance ?? 0) + credits;

  await admin.from("profiles").update({ credits_balance: newBalance }).eq("id", userId);
  await admin.from("transactions").insert({
    user_id: userId,
    type: "subscription_grant",
    credits_amount: credits,
    description,
  });
}

async function markBeatClaimPurchased(token: string | undefined, checkoutSessionId: string) {
  if (!token) return;
  const admin = getAdmin();
  await admin
    .from("beat_claims" as any)
    .update({ purchased_at: new Date().toISOString(), checkout_session_id: checkoutSessionId })
    .eq("token", token)
    .is("purchased_at", null);
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
              await markBeatClaimPurchased(session.metadata?.beatClaimToken, session.id);
              if (session.mode === "subscription" && session.subscription) {
                const subId = typeof session.subscription === "string"
                  ? session.subscription
                  : session.subscription.id;
                const sub = await stripe.subscriptions.retrieve(subId);

                // If checkout had a logged-in user → wire metadata + apply tier
                if (!sub.metadata?.userId && session.metadata?.userId) {
                  await stripe.subscriptions.update(subId, {
                    metadata: { ...sub.metadata, userId: session.metadata.userId },
                  });
                  sub.metadata = { ...sub.metadata, userId: session.metadata.userId };
                }

                if (sub.metadata?.userId) {
                  await applySubscription(env, sub);
                } else {
                  // Guest checkout → issue an invite + email claim link
                  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
                  const customer = await stripe.customers.retrieve(customerId);
                  const email = !customer.deleted ? customer.email : null;
                  const item = sub.items.data[0];
                  let lookupKey = item?.price?.lookup_key ?? null;
                  if (!lookupKey && item?.price?.id) {
                    const price = await stripe.prices.retrieve(item.price.id);
                    lookupKey = price.lookup_key ?? null;
                  }
                  const tier = tierFromLookupKey(lookupKey);
                  if (email && (tier === "artist" || tier === "label")) {
                    const origin = url.origin;
                    await issueInviteAndEmail({
                      email,
                      stripeCustomerId: customerId,
                      stripeSubscriptionId: sub.id,
                      tier,
                      environment: env,
                      origin,
                    });
                  } else {
                    console.warn("[webhook] guest checkout without email or tier", { email, tier });
                  }
                }
              }
              break;
            }
            case "customer.subscription.created":
            case "customer.subscription.updated":
            case "customer.subscription.deleted": {
              await applySubscription(env, event.data.object as Stripe.Subscription);
              break;
            }
            case "invoice.paid":
            case "invoice.payment_succeeded": {
              await grantMonthlyCredits(env, event.data.object as Stripe.Invoice);
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
