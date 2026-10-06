import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type PurchaseDownload = {
  agreementCode: string;
  beatTitle: string;
  buyerName: string | null;
  email: string;
  licenseTier: string;
  licenseLabel: string;
  rightsText: string;
  amountCents: number;
  createdAt: string;
  coverUrl: string | null;
  mp3Url: string | null;
  wavUrl: string | null;
  stemsUrl: string | null;
};

// Public: the token is an unguessable 48-char hex string generated per
// purchase. Whoever holds the link can download that purchase's files and
// agreement — treat it like a password.
export const getPurchaseDownload = createServerFn({ method: "GET" })
  .inputValidator((input: { token: string }) =>
    z.object({ token: z.string().regex(/^[a-f0-9]{48}$/) }).parse(input),
  )
  .handler(async ({ data }): Promise<PurchaseDownload | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await (supabaseAdmin as any)
      .from("purchase_licenses")
      .select("agreement_code,beat_title,buyer_name,email,license_tier,license_label,rights_text,amount_cents,created_at,beat_id")
      .eq("download_token", data.token)
      .maybeSingle();
    if (error) throw new Error("This purchase could not be loaded.");
    if (!row) return null;

    let beat: any = null;
    if (row.beat_id) {
      const { data: b } = await (supabaseAdmin as any)
        .from("beats")
        .select("cover_url,audio_url,audio_url_wav,stems_url")
        .eq("id", row.beat_id)
        .maybeSingle();
      beat = b;
    }

    const tier = row.license_tier as string;
    return {
      agreementCode: row.agreement_code,
      beatTitle: row.beat_title,
      buyerName: row.buyer_name,
      email: row.email,
      licenseTier: tier,
      licenseLabel: row.license_label,
      rightsText: row.rights_text,
      amountCents: row.amount_cents,
      createdAt: row.created_at,
      coverUrl: beat?.cover_url ?? null,
      mp3Url: beat?.audio_url ?? null,
      wavUrl: tier === "nonexclusive" ? null : (beat?.audio_url_wav ?? null),
      stemsUrl: tier === "trackout" ? (beat?.stems_url ?? null) : null,
    };
  });
