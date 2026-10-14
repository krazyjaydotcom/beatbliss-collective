import { z } from "zod";

const name = z.string().trim().max(200);
const ipi = z.string().regex(/^(?:[0-9]{9,11})?$/, "IPI must be blank or 9–11 digits");
const percentage = z.number().finite().min(0).max(100).refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-8, "Use at most two decimal places").nullable();
export const contributorSchema = z.object({
  legal_name: name, credit_name: name,
  role: z.enum(["producer", "co_producer", "additional_production"]),
  writer_ipi: ipi, pro: name, publisher_name: name, publisher_ipi: ipi, publisher_pro: name,
  writer_pct: percentage, publishing_pct: percentage, master_pct: percentage, sales_pct: percentage,
}).refine((c) => !!(c.legal_name || c.credit_name), "A contributor name is required")
  .refine((c) => c.writer_pct === null || !!c.legal_name, "Enter the legal writer name when assigning a writer share")
  .refine((c) => c.publishing_pct === null || !!c.publisher_name, "Enter the publisher name when assigning a publishing share");
export const splitFields = ["writer_pct", "publishing_pct", "master_pct", "sales_pct"] as const;
export type SplitField = typeof splitFields[number];
export type Contributor = z.infer<typeof contributorSchema>;
export const creditConfigSchema = z.object({
  production_credit: z.string().trim().max(300),
  contributors: z.array(contributorSchema).max(50),
  admin_notes: z.string().max(4000),
}).superRefine((c, ctx) => {
  if (c.contributors.length && !c.production_credit) ctx.addIssue({ code: "custom", path: ["production_credit"], message: "Production credit line is required" });
  for (const field of splitFields) {
    const total = c.contributors.reduce((sum, row) => sum + Math.round((row[field] ?? 0) * 100), 0);
    if (total > 10000) ctx.addIssue({ code: "custom", path: ["contributors"], message: `${field.replace("_pct", "")} total exceeds 100%` });
  }
});
export type CreditConfig = z.infer<typeof creditConfigSchema>;
export function emptyContributor(): Contributor {
  return { legal_name: "", credit_name: "", role: "co_producer", writer_ipi: "", pro: "", publisher_name: "", publisher_ipi: "", publisher_pro: "", writer_pct: null, publishing_pct: null, master_pct: null, sales_pct: null };
}
export function generatedCredit(contributors: Contributor[]): string {
  return `Produced by ${contributors.map((c) => c.credit_name.trim() || c.legal_name.trim()).filter(Boolean).join(" and ")}`;
}
export type CreditSnapshot = { version: number; production_credit: string; terms_text: string };
export const legacyCreditTerms = "Producer credits (required): Writer — Jason A. Spencer (IPI 516703075) 50%; Publishing — March 26th Publishing (IPI 1213085595) 50%; PRO — ASCAP. Failure to register these splits voids the rights granted.\n\nRestrictions: Licensee may not resell, redistribute, sublicense, or claim sole ownership of the underlying beat. MYBEATCATALOG retains ownership of the composition and production.";
// Database formatter captures the canonical terms once; every delivered copy uses that snapshot.
export function purchaseCreditTerms(snapshot?: CreditSnapshot | null): string {
  return snapshot?.terms_text ?? legacyCreditTerms;
}
export function purchaseAgreementText(rights: string, amount: number, snapshot?: CreditSnapshot | null, sandbox = false): string {
  return `${rights}\n\n${purchaseCreditTerms(snapshot)}\n\nAmount paid: $${(amount / 100).toFixed(2)}${sandbox ? " (test payment)" : ""}`;
}
