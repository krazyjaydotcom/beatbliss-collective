import assert from "node:assert/strict";
import { test } from "node:test";
import {
  checkoutLineAmounts,
  discountEligibleAmounts,
  isFreePromoOrder,
  isFulfillablePayment,
  isSupportedBeatCoupon,
  isTerminalEmailStatus,
  runRetryableFulfillment,
  sameCheckoutItems,
} from "../src/lib/checkout-pricing.ts";

test("admin tier coupons keep working with their intentional Stripe placeholder product", () => {
  assert.equal(
    isSupportedBeatCoupon({
      metadata: { tiers: "trackout" },
      applies_to: { products: ["prod_placeholder"] },
    }),
    true,
  );
  assert.equal(isSupportedBeatCoupon({ applies_to: { products: ["prod_unrelated"] } }), false);
  assert.equal(isSupportedBeatCoupon({}), true);
});

test("claim retry survives database object-key ordering but rejects changed beat or tier", () => {
  assert.equal(
    sameCheckoutItems(
      [{ tier: "trackout", beatId: "showtime" }],
      [{ beatId: "showtime", tier: "trackout" }],
    ),
    true,
  );
  assert.equal(
    sameCheckoutItems(
      [{ tier: "trackout", beatId: "showtime" }],
      [{ beatId: "showtime", tier: "unlimited" }],
    ),
    false,
  );
  assert.equal(
    sameCheckoutItems(
      [{ tier: "trackout", beatId: "showtime" }],
      [{ beatId: "other", tier: "trackout" }],
    ),
    false,
  );
  assert.equal(sameCheckoutItems([], [{ beatId: "showtime", tier: "trackout" }]), false);
});

test("on-site claims require a validated promo and all items at $0", () => {
  assert.equal(isFreePromoOrder([0], true), true);
  assert.equal(isFreePromoOrder([0, 0], true), true);
  assert.equal(isFreePromoOrder([0, 4999], true), false);
  assert.equal(isFreePromoOrder([2499], false), false);
  assert.equal(isFreePromoOrder([0], false), false);
  assert.equal(isFreePromoOrder([], true), false);
});

test("100% eligible beat promo reaches $0, without a 50-cent floor", () => {
  assert.deepEqual(discountEligibleAmounts([4999], [0], { percent_off: 100 }), [0]);
});
test("mixed cart keeps ineligible license tiers full price", () => {
  assert.deepEqual(
    discountEligibleAmounts([2499, 15000, 4999], [0, 2], { percent_off: 100 }),
    [0, 15000, 0],
  );
});
test("fixed discount caps at eligible subtotal with exact cent allocation", () => {
  assert.deepEqual(
    discountEligibleAmounts([2499, 4999, 15000], [0, 1], { amount_off: 20000 }),
    [0, 0, 15000],
  );
  assert.equal(
    discountEligibleAmounts([2499, 4999], [0, 1], { amount_off: 1000 }).reduce((a, b) => a + b),
    6498,
  );
});
test("no-cost completion fulfills; unpaid delayed checkout does not", () => {
  assert.equal(isFulfillablePayment("no_payment_required"), true);
  assert.equal(isFulfillablePayment("paid"), true);
  assert.equal(isFulfillablePayment("unpaid"), false);
});
test("regular paid checkout retains its actual price", () => {
  assert.deepEqual(
    checkoutLineAmounts([{ beatId: "a", tier: "unlimited" }], [{ amount_total: 4999 }], 4999),
    [4999],
  );
});
test("Stripe's final amounts including zero are mapped by beat and tier, not metadata prices", () => {
  assert.deepEqual(
    checkoutLineAmounts(
      [
        { beatId: "a", tier: "unlimited" },
        { beatId: "b", tier: "trackout" },
      ],
      [
        { beatId: "b", tier: "trackout", amount_total: 15000 },
        { beatId: "a", tier: "unlimited", amount_total: 0 },
      ],
      15000,
    ),
    [0, 15000],
  );
  assert.throws(() =>
    checkoutLineAmounts([{ beatId: "a", tier: "unlimited" }], [{ amount_total: 4999 }], 0),
  );
});
test("failed delivery retries; sent and suppressed email stay terminal", () => {
  assert.equal(isTerminalEmailStatus("failed"), false);
  assert.equal(isTerminalEmailStatus("sent"), true);
  assert.equal(isTerminalEmailStatus("suppressed"), true);
});
test("duplicate completed webhook skips work; failed fulfillment releases and retries", async () => {
  let state = "pending",
    deliveries = 0,
    fail = true;
  const steps = {
    claim: async () => (state === "complete" ? "complete" : "claimed"),
    work: async () => {
      deliveries++;
      if (fail) throw new Error("delivery failed");
    },
    finish: async (complete: boolean) => {
      state = complete ? "complete" : "pending";
    },
  };
  await assert.rejects(runRetryableFulfillment(steps));
  assert.equal(state, "pending");
  fail = false;
  await runRetryableFulfillment(steps);
  await runRetryableFulfillment(steps);
  assert.equal(deliveries, 2);
  assert.equal(state, "complete");
});
test("concurrent webhook cannot work while another claim is busy", async () => {
  let calls = 0;
  await assert.rejects(
    runRetryableFulfillment({
      claim: async () => "busy",
      work: async () => {
        calls++;
      },
      finish: async () => {},
    }),
  );
  assert.equal(calls, 0);
});
