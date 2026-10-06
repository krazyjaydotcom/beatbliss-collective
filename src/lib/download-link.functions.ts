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

// Public: whoever holds the link can download that purchase's files and
// agreement — treat it like a password. Two link shapes resolve a purchase:
//   /d/<short_code>            12-char code, the link we send buyers
//   /download/<download_token> legacy 48-char hex, still in older emails
async function loadPurchase(
  column: "short_code" | "download_token",
  value: string,
): Promise<PurchaseDownload | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: row, error } = await (supabaseAdmin as any)
    .from("purchase_licenses")
    .select("agreement_code,beat_title,buyer_name,email,license_tier,license_label,rights_text,amount_cents,created_at,beat_id")
    .eq(column, value)
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
}

// Short buyer link: mybeatcatalog.com/d/<short_code>
export const getPurchaseDownloadByCode = createServerFn({ method: "GET" })
  .inputValidator((input: { code: string }) =>
    z.object({ code: z.string().regex(/^[A-Za-z0-9_-]{8,16}$/) }).parse(input),
  )
  .handler(async ({ data }) => loadPurchase("short_code", data.code));

// Legacy link: mybeatcatalog.com/download/<48-char hex token>
export const getPurchaseDownload = createServerFn({ method: "GET" })
  .inputValidator((input: { token: string }) =>
    z.object({ token: z.string().regex(/^[a-f0-9]{48}$/) }).parse(input),
  )
  .handler(async ({ data }) => loadPurchase("download_token", data.token));
