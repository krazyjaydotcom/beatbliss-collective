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

type SendFoxResult = {
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
  return (inputOrigin || process.env.PUBLIC_SITE_URL || process.env.SITE_URL || "https://mybeatcatalog.com").replace(//$/, "");
}

async function sendToSendFox(params: {
  email: string;
  beatTitle: string;
  offerUrl: string;
  source?: string | null;
}): Promise<SendFoxResult> {
  const apiToken = process.env.SENDFOX_API_TOKEN;
  const listId = process.env.SENDFOX_LIST_ID;

  if (!apiToken || !listId) {
    return { configured: false, ok: false, error: "SENDFOX_API_TOKEN or SENDFOX_LIST_ID is missing." };
  }

  const contactFields: Record<string, string> = {
    beat_title: params.beatTitle,
    offer_url: params.offerUrl,
    source: params.source || "beat-claim",
  };

  const basePayload = {
    email: params.email,
    lists: [Number(listId)],
  };

  const send = async (payload: Record<string, unknown>) => {
    return fetch("https://api.sendfox.com/contacts", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + apiToken,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  };

  try {
    let res = await send({ ...basePayload, contact_fields: contactFields });

    // Some SendFox accounts require custom fields to exist before they can be set.
    // If that fails, still add the lead to the list so the funnel does not break.
    if (!res.ok) {
      res = await send(basePayload);
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { configured: true, ok: false, error: text || "SendFox rejected the contact." };
    }

    return { configured: true, ok: true };
  } catch (err) {
    return {
      configured: true,
      ok: false,
      error: err instanceof Error ? err.message : "SendFox request failed.",
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
    sendfox: SendFoxResult;
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
      const sendfox = await sendToSendFox({
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
        sendfox,
        error: null,
      };
    } catch (err) {
      return {
        ok: false,
        token: null,
        offerUrl: null,
        expiresAt: null,
        sendfox: { configured: !!process.env.SENDFOX_API_TOKEN && !!process.env.SENDFOX_LIST_ID, ok: false },
        error: err instanceof Error ? err.message : "Unable to claim this beat.",
      };
    }
  });
