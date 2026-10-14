import assert from "node:assert/strict";
import { creditConfigSchema, emptyContributor, purchaseAgreementText, purchaseCreditTerms, generatedCredit } from "../src/lib/beat-credits.ts";

const row = { ...emptyContributor(), legal_name: "Test Writer", credit_name: "Test Producer", publisher_name: "Test Publisher", writer_ipi: "00123456789", publisher_ipi: "001234567", writer_pct: 25, publishing_pct: 25 };
const config = { production_credit: generatedCredit([row]), contributors: [row], admin_notes: "" };
assert.equal(creditConfigSchema.parse(config).contributors[0].writer_ipi, "00123456789");
for (const patch of [{ writer_pct: -1 }, { publishing_pct: 101 }, { master_pct: Infinity }, { sales_pct: NaN }, { sales_pct: 0.001 }, { writer_ipi: "123abc456" }, { legal_name: "" }, { publisher_name: "" }]) {
  assert.equal(creditConfigSchema.safeParse({ ...config, contributors: [{ ...row, ...patch }] }).success, false, JSON.stringify(patch));
}
assert.equal(creditConfigSchema.safeParse({ ...config, contributors: [{ ...row, writer_pct: 60 }, { ...row, writer_pct: 60 }] }).success, false);
assert.equal(creditConfigSchema.safeParse({ ...config, contributors: [{ ...emptyContributor(), credit_name: "Credit Only" }] }).success, true);
assert.match(purchaseCreditTerms(null), /Jason A. Spencer/);
const snapshot = { version: 1, production_credit: "Produced by Test Producer", terms_text: "Test Writer (IPI 00123456789) — 25% writer share" };
assert.equal(purchaseCreditTerms(snapshot), snapshot.terms_text);
assert.equal(purchaseAgreementText("Rights", 2499, snapshot), `Rights\n\n${snapshot.terms_text}\n\nAmount paid: $24.99`);
assert.match(purchaseAgreementText("Rights", 2499, snapshot, true), /test payment/);
assert.doesNotMatch(purchaseAgreementText("Rights", 2499, snapshot), /Jason A. Spencer/);
console.log("Client validation, credit-only contributors, IPI preservation, legacy fallback, and agreement snapshot formatting passed");
