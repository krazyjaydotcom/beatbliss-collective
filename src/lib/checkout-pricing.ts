/** Integer-cent discounts: eligible items may reach zero, never below it. */
export function discountEligibleAmounts(
  amounts: readonly number[],
  eligible: readonly number[],
  coupon: { percent_off?: number | null; amount_off?: number | null },
): number[] {
  const result = [...amounts];
  const total = eligible.reduce((sum, i) => sum + (amounts[i] ?? 0), 0);
  if (total <= 0) return result;
  const fixedDiscount = Math.min(total, Math.max(0, coupon.amount_off ?? 0));
  let cumulative = 0;
  let allocated = 0;
  for (const i of eligible) {
    const amount = amounts[i];
    if (amount === undefined) throw new Error("Invalid discount item");
    cumulative += amount;
    const target = Math.round((fixedDiscount * cumulative) / total);
    const off =
      coupon.percent_off != null
        ? Math.round((amount * coupon.percent_off) / 100)
        : target - allocated;
    allocated = target;
    result[i] = Math.max(0, amount - Math.min(amount, Math.max(0, off)));
  }
  return result;
}

export function isFulfillablePayment(status: string | null | undefined): boolean {
  return status === "paid" || status === "no_payment_required";
}

/** Only a validated promo reducing every item to zero can bypass payment. */
export function isFreePromoOrder(amounts: readonly number[], hasPromo: boolean): boolean {
  return hasPromo && amounts.length > 0 && amounts.every((amount) => amount === 0);
}

/** JSONB may reorder object keys: compare values, never JSON serialization. */
export function sameCheckoutItems(
  a: readonly { beatId: string; tier: string }[],
  b: readonly { beatId: string; tier: string }[],
): boolean {
  return (
    a.length === b.length &&
    a.every((item, index) => item.beatId === b[index]?.beatId && item.tier === b[index]?.tier)
  );
}

/** Admin tier coupons intentionally target a placeholder product in Stripe. */
export function isSupportedBeatCoupon(coupon: {
  metadata?: { tiers?: string };
  applies_to?: { products?: string[] };
}): boolean {
  return !!coupon.metadata?.tiers || !coupon.applies_to?.products?.length;
}

export function isTerminalEmailStatus(status: string): boolean {
  return status === "sent" || status === "suppressed";
}

/** Only Stripe's settled line totals, not pre-discount metadata, are financial truth. */
export function checkoutLineAmounts(
  items: readonly { beatId: string; tier: string }[],
  lines: readonly { amount_total: number; beatId?: string; tier?: string }[],
  total: number,
): number[] {
  if (lines.length !== items.length) throw new Error("Checkout line count does not match purchase");
  const mapped = items.map((item, index) => {
    const line =
      lines.find((l) => l.beatId === item.beatId && l.tier === item.tier) ??
      (lines.every((l) => !l.beatId) ? lines[index] : undefined);
    if (!line || !Number.isSafeInteger(line.amount_total) || line.amount_total < 0) {
      throw new Error("Checkout line amount unavailable");
    }
    return line.amount_total;
  });
  if (mapped.reduce((sum, amount) => sum + amount, 0) !== total) {
    throw new Error("Checkout line totals do not match order total");
  }
  return mapped;
}

export async function runRetryableFulfillment(steps: {
  claim: () => Promise<string>;
  work: () => Promise<void>;
  finish: (complete: boolean) => Promise<void>;
}): Promise<void> {
  const claim = await steps.claim();
  if (claim === "complete") return;
  if (claim !== "claimed")
    throw new Error("Purchase fulfillment is already processing; retry later");
  try {
    await steps.work();
    await steps.finish(true);
  } catch (error) {
    await steps.finish(false);
    throw error;
  }
}
