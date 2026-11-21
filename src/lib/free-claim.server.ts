import type Stripe from "stripe";
import { fulfillBeatCheckout } from "@/lib/beat-checkout-fulfillment.server";

export interface ClaimDownload {
  title: string;
  label: string;
  url: string;
}

/** The request UUID is a private retry capability, bound to the original buyer/cart. */
export async function finishFreeClaim(
  session: Stripe.Checkout.Session,
  stripe: Stripe,
  admin: any,
  environment: "sandbox" | "live",
) {
  let deliveryPending = false;
  try {
    const count = (session.metadata?.beat_ids ?? "").split(",").filter(Boolean).length;
    await fulfillBeatCheckout(
      session,
      stripe,
      admin,
      environment,
      Array.from({ length: count }, () => 0),
    );
  } catch (error) {
    console.error("[free-claim] fulfillment retry needed", error);
    deliveryPending = true;
  }
  const { data: licenses, error } = await admin
    .from("purchase_licenses")
    .select("beat_title,license_label,short_code")
    .eq("stripe_session_id", session.id)
    .eq("payment_environment", environment);
  if (error) throw error;
  const downloads: ClaimDownload[] = (licenses ?? [])
    .filter((l: any) => l.short_code)
    .map((l: any) => ({
      title: l.beat_title,
      label: l.license_label,
      url: `https://mybeatcatalog.com/d/${l.short_code}`,
    }));
  return { clientSecret: null, error: null, freeOrder: true, downloads, deliveryPending };
}
