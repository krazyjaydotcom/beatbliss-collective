import type Stripe from "stripe";
import {
  checkoutLineAmounts,
  isFulfillablePayment,
  runRetryableFulfillment,
} from "@/lib/checkout-pricing";
import {
  agreementCode,
  queueAdminSaleEmail,
  queueBuyerPurchaseEmail,
  TIER_EMAIL,
  type PurchaseTier,
} from "@/lib/beat-landing-email.server";

/** Called only after Stripe signature verification; durable locks protect retries. */
export async function fulfillBeatCheckout(
  session: Stripe.Checkout.Session,
  stripe: Stripe,
  admin: any,
  environment: "sandbox" | "live",
  trustedFreeAmounts?: number[],
) {
  if (!isFulfillablePayment(session.payment_status)) return;
  const token = crypto.randomUUID();
  await runRetryableFulfillment({
    claim: async () => {
      const { data, error } = await admin.rpc("claim_beat_checkout", {
        p_environment: environment,
        p_session_id: session.id,
        p_token: token,
      });
      if (error) throw error;
      return data;
    },
    finish: async (complete) => {
      const { error } = await admin
        .from("beat_checkout_fulfillments")
        .update({
          status: complete ? "complete" : "pending",
          lease_until: null,
          updated_at: new Date().toISOString(),
        })
        .eq("environment", environment)
        .eq("session_id", session.id)
        .eq("lease_token", token);
      if (error) throw error;
    },
    work: async () => {
      const email = (
        session.customer_details?.email ||
        session.customer_email ||
        session.metadata?.buyer_email ||
        ""
      ).toLowerCase();
      if (!email) throw new Error("Completed beat checkout has no buyer email");
      const single = session.metadata?.source === "beat_landing";
      const beatIds =
        (single ? session.metadata?.beat_id : session.metadata?.beat_ids)
          ?.split(",")
          .filter(Boolean) ?? [];
      const tiers = single ? ["unlimited"] : (session.metadata?.tiers ?? "").split(",");
      if (!beatIds.length || new Set(beatIds).size !== beatIds.length)
        throw new Error("Invalid checkout beat list");
      const items = beatIds.map((beatId, i) => {
        const tier = tiers[i];
        if (tier !== "nonexclusive" && tier !== "unlimited" && tier !== "trackout")
          throw new Error("Invalid checkout license tier");
        return { beatId, tier };
      });
      const lines = trustedFreeAmounts
        ? { has_more: false, data: [] }
        : await stripe.checkout.sessions.listLineItems(session.id, {
            limit: 100,
            expand: ["data.price.product"],
          });
      if (lines.has_more) throw new Error("Unexpected checkout line pagination");
      if (
        trustedFreeAmounts &&
        (session.amount_total !== 0 ||
          !session.id.startsWith("free_") ||
          trustedFreeAmounts.length !== items.length ||
          trustedFreeAmounts.some((amount) => amount !== 0))
      )
        throw new Error("Invalid trusted free order");
      const amounts =
        trustedFreeAmounts ??
        checkoutLineAmounts(
          items,
          lines.data.map((line) => {
            const product = line.price?.product;
            const metadata =
              typeof product === "object" && !product.deleted ? product.metadata : undefined;
            return {
              amount_total: line.amount_total,
              beatId: metadata?.beat_id,
              tier: metadata?.license_tier,
            };
          }),
          session.amount_total ?? 0,
        );

      const promoId = session.metadata?.discount_promo_id;
      if (promoId) {
        if (!/^promo_[A-Za-z0-9]+$/.test(promoId)) throw new Error("Invalid saved promotion ID");
        const promo = await stripe.promotionCodes.retrieve(promoId);
        const { data: count, error } = await admin.rpc("record_beat_promo_redemption", {
          p_environment: environment,
          p_promo_id: promoId,
          p_session_id: session.id,
          p_legacy_count: Number(promo.metadata?.["tier_redemptions"] ?? 0),
        });
        if (error) throw error;
        // Cloud is the authoritative counter; Stripe metadata is only a display mirror.
        await stripe.promotionCodes.update(promoId, {
          metadata: { ...promo.metadata, tier_redemptions: String(count) },
          ...(promo.max_redemptions && Number(count) + promo.times_redeemed >= promo.max_redemptions
            ? { active: false }
            : {}),
        });
      }

      const { data: beats, error: beatError } = await admin
        .from("beats")
        .select("id,title,audio_url,audio_url_wav,stems_url,landing_slug")
        .in("id", beatIds);
      if (beatError) throw beatError;
      const byId = new Map<string, any>((beats ?? []).map((beat: any) => [beat.id, beat]));
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item) throw new Error("Missing checkout item");
        const beat = byId.get(item.beatId);
        if (!beat) throw new Error("Purchased beat unavailable for delivery");
        const tier = item.tier as PurchaseTier;
        const purchaseId = single ? session.id : `${session.id}:${item.beatId}`;
        const { data: license, error } = await admin.rpc("record_beat_checkout_item", {
          p_license: {
            agreement_code: agreementCode(purchaseId),
            email,
            buyer_name:
              session.customer_details?.individual_name ?? session.customer_details?.name ?? null,
            beat_id: item.beatId,
            beat_title: beat.title,
            license_tier: tier,
            license_label: TIER_EMAIL[tier].label,
            rights_text: TIER_EMAIL[tier].rights,
            amount_cents: amounts[i],
            stripe_session_id: session.id,
            payment_environment: environment,
          },
          p_funnel: {
            utm_source: session.metadata?.utm_source,
            utm_medium: session.metadata?.utm_medium,
            utm_campaign: session.metadata?.utm_campaign,
            utm_content: session.metadata?.utm_content,
            session_key: session.metadata?.attribution_session,
          },
        });
        if (error || !license) throw error || new Error("Saved purchase license unavailable");
        await queueBuyerPurchaseEmail({
          to: license.email,
          buyerName: license.buyer_name,
          purchasedAt: license.created_at,
          beatTitle: license.beat_title,
          licenseTier: tier,
          downloadUrl: beat.audio_url,
          wavUrl: beat.audio_url_wav,
          stemsUrl: beat.stems_url,
          amountCents: license.amount_cents,
          sessionId: purchaseId,
          beatSlug: beat.landing_slug,
          agreementCode: license.agreement_code,
          creditSnapshot: license.credit_snapshot,
          downloadPageUrl: license.short_code
            ? `https://mybeatcatalog.com/d/${license.short_code}`
            : `https://mybeatcatalog.com/download/${license.download_token}`,
        });
      }
      await queueAdminSaleEmail({
        beatTitle: items.map((item) => byId.get(item.beatId).title).join(", "),
        licenseLabel: [
          ...new Set(items.map((item) => TIER_EMAIL[item.tier as PurchaseTier].label)),
        ].join(" + "),
        buyerEmail: email,
        amountCents: session.amount_total ?? 0,
        sessionId: session.id,
        buyerName: session.customer_details?.name ?? null,
        promoCode: session.metadata?.discount_code ?? null,
        beatSlug:
          items.length === 1 ? (byId.get(items[0]?.beatId ?? "")?.landing_slug ?? null) : null,
      });
    },
  });
}
