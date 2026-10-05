import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Public: a buyer enters their email and we EMAIL their licenses to that
 * address. The response is identical whether or not licenses exist, so the
 * form can't be used to check who bought what.
 */
export const requestMyLicenses = createServerFn({ method: "POST" })
  .inputValidator((input: { email: string; website?: string }) =>
    z.object({ email: z.string().trim().email().max(255), website: z.string().max(200).optional() }).parse(input),
  )
  .handler(async ({ data }) => {
    if (data.website) return { ok: true };
    const email = data.email.toLowerCase();
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: rows } = await (supabaseAdmin as any)
        .from("purchase_licenses")
        .select("agreement_code,beat_title,license_label,rights_text,amount_cents,created_at,buyer_name")
        .ilike("email", email)
        .order("created_at", { ascending: false })
        .limit(100);
      if (rows && rows.length > 0) {
        const { queueLicenseLookupEmail } = await import("@/lib/beat-landing-email.server");
        await queueLicenseLookupEmail({ to: email, licenses: rows });
      }
    } catch (err) {
      console.error("[licenses] lookup failed", err);
    }
    return { ok: true };
  });
