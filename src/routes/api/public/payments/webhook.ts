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

function tierFromMetadataOrLookup(metadataTier: string | undefined, lookupKey: string | null | undefined) {
  if (metadataTier === "artist" || metadataTier === "label" || metadataTier === "none") return metadataTier;
  return tierFromLookupKey(lookupKey);
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
    : tierFromMetadataOrLookup(sub.metadata?.tier, lookupKey);

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
  const tier = tierFromMetadataOrLookup(sub.metadata?.tier, lookupKey);
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
    .gt("expires_at", new Date().toISOString())
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

              // NEW: beat-landing lease purchase delivery. Isolated from membership flow.
              if (session.metadata?.source === "beat_landing") {
                try {
                  const admin = getAdmin();
                  const beatId = session.metadata?.beat_id;
                  const beatSlug = session.metadata?.beat_slug || null;
                  const buyerEmail =
                    session.customer_details?.email ||
                    session.customer_email ||
                    session.metadata?.buyer_email ||
                    null;
                  const amount = session.amount_total ?? 0;

                  let beatTitle = session.metadata?.beat_title || "Your beat";
                  let downloadUrl: string | null = null;
                  if (beatId) {
                    const { data: b } = await admin
                      .from("beats")
                      .select("title,audio_url,audio_url_tagged,landing_slug")
                      .eq("id", beatId)
                      .maybeSingle();
                    if (b) {
                      beatTitle = (b as any).title ?? beatTitle;
                      downloadUrl = (b as any).audio_url ?? (b as any).audio_url_tagged ?? null;
                    }
                  }

                  // Mark the recorded lease order as actually paid so the admin
                  // Sales dashboard can separate real sales from abandoned checkouts.
                  try {
                    const { data: existingPaid } = await admin
                      .from("lease_orders")
                      .select("id")
                      .eq("stripe_session_id", session.id)
                      .limit(1);
                    if (!existingPaid || existingPaid.length === 0) {
                      let matched = false;
                      if (buyerEmail && beatId) {
                        const { data: pending } = await admin
                          .from("lease_orders")
                          .select("id")
                          .eq("email", buyerEmail.toLowerCase())
                          .eq("beat_id", beatId)
                          .is("stripe_session_id", null)
                          .order("created_at", { ascending: false })
                          .limit(1);
                        if (pending && pending.length > 0) {
                          await admin
                            .from("lease_orders")
                            .update({ stripe_session_id: session.id, amount_cents: amount, license_tier: "unlimited" })
                            .eq("id", (pending[0] as any).id);
                          matched = true;
                        }
                      }
                      if (!matched && buyerEmail) {
                        await admin.from("lease_orders").insert({
                          email: buyerEmail.toLowerCase(),
                          beat_id: beatId ?? null,
                          amount_cents: amount,
                          used_first_time_discount: false,
                          stripe_session_id: session.id,
                          license_tier: "unlimited",
                        });
                      }
                    }
                  } catch (err) {
                    console.error("[webhook] lease_orders reconcile failed", err);
                  }

                  const { queueBuyerPurchaseEmail, queueAdminSaleEmail } = await import(
                    "@/lib/beat-landing-email.server"
                  );
                  if (buyerEmail) {
                    await queueBuyerPurchaseEmail({
                      to: buyerEmail,
                      beatTitle,
                      downloadUrl,
                      amountCents: amount,
                      sessionId: session.id,
                      beatSlug,
                    });
                  } else {
                    console.warn("[webhook] beat_landing session missing buyer email", session.id);
                  }
                  await queueAdminSaleEmail({
                    beatTitle,
                    buyerEmail: buyerEmail || "(unknown)",
                    amountCents: amount,
                    sessionId: session.id,
                    beatSlug,
                  });
                } catch (err) {
                  // Never fail the webhook on email issues — Stripe would retry forever.
                  console.error("[webhook] beat_landing delivery emails failed", err);
                }
                break;
              }

              // Multi-beat cart purchase: reconcile one lease order per beat and
              // deliver every beat in the same way a single purchase is delivered.
              if (session.metadata?.source === "beat_cart") {
                // License-limited discount codes are applied by us (not Stripe),
                // so count the use on the promotion code ourselves.
                const promoId = session.metadata?.discount_promo_id;
                if (promoId && /^promo_[A-Za-z0-9]+$/.test(promoId)) {
                  try {
                    const s = createStripeClient(env);
                    const p: any = await s.promotionCodes.retrieve(promoId);
                    const used = Number(p.metadata?.tier_redemptions ?? 0) + 1;
                    await s.promotionCodes.update(promoId, {
                      metadata: { ...(p.metadata ?? {}), tier_redemptions: String(used) },
                      ...(p.max_redemptions && used >= p.max_redemptions ? { active: false } : {}),
                    });
                  } catch (err) {
                    console.error("[webhook] discount redemption count failed", err);
                  }
                }
                try {
                  const admin = getAdmin();
                  const buyerEmail = (
                    session.customer_details?.email ||
                    session.customer_email ||
                    session.metadata?.buyer_email ||
                    ""
                  ).toLowerCase();
                  const beatIds = (session.metadata?.beat_ids ?? "")
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean);
                  const tiers = (session.metadata?.tiers ?? "").split(",").map((s) => s.trim());
                  const amounts = (session.metadata?.amounts ?? "").split(",").map((s) => Number(s) || 0);

                  const { data: alreadyHandled } = await admin
                    .from("lease_orders")
                    .select("id")
                    .eq("stripe_session_id", session.id)
                    .limit(1);
                  if (alreadyHandled && alreadyHandled.length > 0) {
                    if (session.payment_status === "paid") {
                      await admin.from("purchase_funnel_events").upsert(
                        beatIds.map((beatId, i) => ({ event_type: "purchase_confirmed", beat_id: beatId, license_tier: tiers[i] || null, utm_source: session.metadata?.utm_source || null, utm_medium: session.metadata?.utm_medium || null, utm_campaign: session.metadata?.utm_campaign || null, utm_content: session.metadata?.utm_content || null, session_key: session.metadata?.attribution_session || null, stripe_session_id: session.id, amount_cents: amounts[i] ?? 0, payment_environment: env })),
                        { onConflict: "payment_environment,stripe_session_id,beat_id", ignoreDuplicates: true },
                      );
                    }
                    break;
                  }

                  const { data: beats } = await admin
                    .from("beats")
                    .select("id,title,audio_url,audio_url_tagged,landing_slug")
                    .in("id", beatIds);
                  const byId = new Map(
                    ((beats ?? []) as any[]).map((b) => [b.id as string, b]),
                  );

                  const { queueBuyerPurchaseEmail, queueAdminSaleEmail } = await import(
                    "@/lib/beat-landing-email.server"
                  );

                  for (let i = 0; i < beatIds.length; i += 1) {
                    const beatId = beatIds[i]!;
                    const beat = byId.get(beatId) as any;
                    const beatTitle = beat?.title ?? "Your beat";
                    const licenseType = tiers[i] ?? "lease";

                    try {
                      const { data: pending } = await admin
                        .from("lease_orders")
                        .select("id")
                        .eq("email", buyerEmail)
                        .eq("beat_id", beatId)
                        .is("stripe_session_id", null)
                        .order("created_at", { ascending: false })
                        .limit(1);
                      if (pending && pending.length > 0) {
                        await admin
                          .from("lease_orders")
                           .update({ stripe_session_id: session.id, license_tier: licenseType, amount_cents: amounts[i] ?? 0 })
                          .eq("id", (pending[0] as any).id);
                      } else if (buyerEmail) {
                        await admin.from("lease_orders").insert({
                          email: buyerEmail,
                          beat_id: beatId,
                           amount_cents: amounts[i] ?? 0,
                          used_first_time_discount: false,
                          stripe_session_id: session.id,
                          license_tier: licenseType,
                        });
                      }
                    } catch (err) {
                      console.error("[webhook] beat_cart order reconcile failed", err);
                    }

                    if (buyerEmail) {
                      const tierKey = (["nonexclusive", "unlimited", "trackout"] as const).find((t) => t === licenseType) ?? "unlimited";
                      const { TIER_EMAIL, agreementCode } = await import("@/lib/beat-landing-email.server");
                      const licSession = `${session.id}:${beatId}`;
                      const code = agreementCode(licSession);
                      let downloadToken: string | null = null;
                      let shortCode: string | null = null;
                      try {
                        await admin.from("purchase_licenses" as any).upsert({
                          agreement_code: code,
                          email: buyerEmail,
                          buyer_name: session.customer_details?.name ?? null,
                          beat_id: beatId,
                          beat_title: beatTitle,
                          license_tier: tierKey,
                          license_label: TIER_EMAIL[tierKey].label,
                          rights_text: TIER_EMAIL[tierKey].rights,
                          amount_cents: amounts[i] ?? 0,
                          stripe_session_id: session.id,
                          payment_environment: env,
                        } as any, { onConflict: "stripe_session_id,beat_id", ignoreDuplicates: true });
                        const { data: licRow } = await admin
                          .from("purchase_licenses" as any)
                          .select("download_token,short_code")
                          .eq("stripe_session_id", session.id)
                          .eq("beat_id", beatId)
                          .maybeSingle();
                        downloadToken = (licRow as any)?.download_token ?? null;
                        shortCode = (licRow as any)?.short_code ?? null;
                      } catch (err) {
                        console.error("[webhook] license record failed", err);
                      }
                      try {
                        await queueBuyerPurchaseEmail({
                          agreementCode: code,
                          stemsUrl: beat?.stems_url ?? null,
                          to: buyerEmail,
                          beatTitle,
                          downloadUrl: beat?.audio_url ?? null,
                          wavUrl: beat?.audio_url_wav ?? null,
                          licenseTier: tierKey,
                          amountCents: amounts[i] ?? 0,
                          sessionId: `${session.id}:${beatId}`,
                          beatSlug: beat?.landing_slug ?? null,
                          downloadPageUrl: shortCode
                            ? `https://mybeatcatalog.com/d/${shortCode}`
                            : downloadToken
                              ? `https://mybeatcatalog.com/download/${downloadToken}`
                              : null,
                        });
                      } catch (err) {
                        console.error("[webhook] buyer delivery email failed", err);
                      }
                    }
                  }

                  const tierNames: Record<string, string> = { nonexclusive: "Non-Exclusive MP3", unlimited: "Unlimited License", trackout: "Unlimited w/ STEMs" };
                  const titles = beatIds.map((id) => ((byId.get(id) as any)?.title as string | undefined) ?? "Beat");
                  const firstSlug = beatIds.length === 1 ? (((byId.get(beatIds[0]!) as any)?.landing_slug as string | null) ?? null) : null;
                  await queueAdminSaleEmail({
                    beatTitle: titles.join(", "),
                    licenseLabel: [...new Set(tiers.map((t) => tierNames[t] ?? t))].join(" + ") || "Beat license",
                    buyerEmail: buyerEmail || "(unknown)",
                    amountCents: session.amount_total ?? 0,
                    sessionId: session.id,
                    beatSlug: firstSlug,
                  });

                  if (session.payment_status === "paid") try {
                    await admin.from("purchase_funnel_events").upsert(
                      beatIds.map((beatId, i) => ({
                        event_type: "purchase_confirmed",
                        beat_id: beatId,
                        license_tier: tiers[i] || null,
                        utm_source: session.metadata?.utm_source || null,
                        utm_medium: session.metadata?.utm_medium || null,
                        utm_campaign: session.metadata?.utm_campaign || null,
                        utm_content: session.metadata?.utm_content || null,
                        session_key: session.metadata?.attribution_session || null,
                        stripe_session_id: session.id,
                        amount_cents: amounts[i] ?? 0,
                        payment_environment: env,
                      })),
                      { onConflict: "payment_environment,stripe_session_id,beat_id", ignoreDuplicates: true },
                    );
                  } catch (err) {
                    console.error("[webhook] paid funnel event failed", err);
                  }
                } catch (err) {
                  console.error("[webhook] beat_cart handling failed", err);
                }
                break;
              }

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
                  const tier = tierFromMetadataOrLookup(sub.metadata?.tier, lookupKey);
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
          // Log but return 200 so Stripe doesn't retry forever for otherwise-valid events.
          console.error("[webhook] handler error", err);
          return new Response("ok", { status: 200 });
        }


        return new Response("ok", { status: 200 });
      },
    },
  },
});
