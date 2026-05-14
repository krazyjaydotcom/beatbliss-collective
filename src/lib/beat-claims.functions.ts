import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type ClaimResult = {
  token: string;
  expires_at: string;
  beat_id: string;
  reused: boolean;
};

type BeatOffer = {
  token: string;
  email: string;
  beat_id: string;
  title: string;
  genre: string | null;
  mood: string | null;
  bpm: number | null;
};

type EmailProviderResult = {
  configured: boolean;
  ok: boolean;
  error?: string;
};

const inputSchema = z.object({
  email: z.string().email().max(254),
  beatId: z.string().uuid(),
  source: z.string().max(120).optional().nullable(),
  origin: z.string().url().max(2048).optional(),
});

function getPublicOrigin(inputOrigin?: string) {
  const origin = inputOrigin || process.env.PUBLIC_SITE_URL || process.env.SITE_URL || "https://mybeatcatalog.com";
  return origin.endsWith("/") ? origin.slice(0, -1) : origin;
}

async function sendToSendy(params: {
  email: string;
  beatTitle: string;
  offerUrl: string;
  source?: string | null;
}): Promise<EmailProviderResult> {
  const baseUrl = process.env.SENDY_BASE_URL;
  const apiKey = process.env.SENDY_API_KEY;
  const listId = process.env.SENDY_LIST_ID;

  if (!baseUrl || !apiKey || !listId) {
    return { configured: false, ok: false, error: "SENDY_BASE_URL, SENDY_API_KEY, or SENDY_LIST_ID is missing." };
  }

  try {
    const url = baseUrl.replace(/\/+$/, "") + "/subscribe";
    const form = new URLSearchParams({
      api_key: apiKey,
      list: listId,
      email: params.email,
      boolean: "true",
      BeatTitle: params.beatTitle,
      OfferUrl: params.offerUrl,
      Source: params.source || "beat-claim",
      referrer: params.source || "beat-claim",
    });

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
    const text = (await res.text()).trim();
    if (res.ok && (text === "1" || text.toLowerCase() === "true" || /already subscribed/i.test(text))) {
      return { configured: true, ok: true };
    }
    return { configured: true, ok: false, error: text || ("Sendy returned status " + res.status) };
  } catch (err) {
    return {
      configured: true,
      ok: false,
      error: err instanceof Error ? err.message : "Sendy request failed.",
    };
  }
}

export const claimBeatAndSendFox = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }): Promise<{
    ok: boolean;
    token: string | null;
    offerUrl: string | null;
    expiresAt: string | null;
    sendfox: EmailProviderResult;
    sendy: EmailProviderResult;
    error: string | null;
  }> => {
    try {
      const email = data.email.trim().toLowerCase();
      const source = data.source?.trim() || null;
      const { data: claimRows, error: claimError } = await (supabaseAdmin as any).rpc("claim_beat", {
        _email: email,
        _beat_id: data.beatId,
        _source: source,
      });

      if (claimError) throw claimError;
      const claim = (Array.isArray(claimRows) ? claimRows[0] : claimRows) as ClaimResult | undefined;
      if (!claim?.token) throw new Error("Beat claim could not be created.");

      const { data: offerRows } = await (supabaseAdmin as any).rpc("get_beat_offer", {
        _token: claim.token,
      });
      const offer = (Array.isArray(offerRows) ? offerRows[0] : offerRows) as BeatOffer | undefined;
      const origin = getPublicOrigin(data.origin);
      const offerUrl = origin + "/offer/" + claim.token;
      const sendy = await sendToSendy({
        email,
        beatTitle: offer?.title || "Selected Beat",
        offerUrl,
        source,
      });

      return {
        ok: true,
        token: claim.token,
        offerUrl,
        expiresAt: claim.expires_at,
        sendfox: sendy,
        sendy,
        error: null,
      };
    } catch (err) {
      return {
        ok: false,
        token: null,
        offerUrl: null,
        expiresAt: null,
        sendfox: {
          configured: !!process.env.SENDY_BASE_URL && !!process.env.SENDY_API_KEY && !!process.env.SENDY_LIST_ID,
          ok: false,
        },
        sendy: {
          configured: !!process.env.SENDY_BASE_URL && !!process.env.SENDY_API_KEY && !!process.env.SENDY_LIST_ID,
          ok: false,
        },
        error: err instanceof Error ? err.message : "Unable to claim this beat.",
      };
    }
  });
