import { createFileRoute } from "@tanstack/react-router";
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
  deviceFingerprint: z.string().max(128).optional().nullable(),
});

function getPublicOrigin(inputOrigin?: string) {
  const origin = inputOrigin || process.env.PUBLIC_SITE_URL || process.env.SITE_URL || "https://mybeatcatalog.com";
  return origin.endsWith("/") ? origin.slice(0, -1) : origin;
}

function getClientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (
    forwarded ||
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-client-ip") ||
    null
  );
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
    return { configured: true, ok: false, error: text || "Sendy returned status " + res.status };
  } catch (err) {
    return {
      configured: true,
      ok: false,
      error: err instanceof Error ? err.message : "Sendy request failed.",
    };
  }
}

export const Route = createFileRoute("/api/public/beat-claim")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const input = inputSchema.parse(await request.json());
          const email = input.email.trim().toLowerCase();
          const source = input.source?.trim() || null;
          const { data: claimRows, error: claimError } = await (supabaseAdmin as any).rpc("claim_beat", {
            _email: email,
            _beat_id: input.beatId,
            _source: source,
            _ip_address: getClientIp(request),
            _user_agent: request.headers.get("user-agent"),
            _device_fingerprint: input.deviceFingerprint?.trim() || null,
          });

          if (claimError) throw claimError;
          const claim = (Array.isArray(claimRows) ? claimRows[0] : claimRows) as ClaimResult | undefined;
          if (!claim?.token) throw new Error("Beat claim could not be created.");

          const { data: offerRows } = await (supabaseAdmin as any).rpc("get_beat_offer", {
            _token: claim.token,
          });
          const offer = (Array.isArray(offerRows) ? offerRows[0] : offerRows) as BeatOffer | undefined;
          const origin = getPublicOrigin(input.origin);
          const offerUrl = origin + "/offer/" + claim.token;
          const sendy = await sendToSendy({
            email,
            beatTitle: offer?.title || "Selected Beat",
            offerUrl,
            source,
          });

          return Response.json({
            ok: true,
            token: claim.token,
            offerUrl,
            expiresAt: claim.expires_at,
            sendy,
            sendfox: sendy,
            error: null,
          });
        } catch (err) {
          const configured = !!process.env.SENDY_BASE_URL && !!process.env.SENDY_API_KEY && !!process.env.SENDY_LIST_ID;
          return Response.json(
            {
              ok: false,
              token: null,
              offerUrl: null,
              expiresAt: null,
              sendy: { configured, ok: false },
              sendfox: { configured, ok: false },
              error: err instanceof Error ? err.message : "Unable to claim this beat.",
            },
            { status: 400 },
          );
        }
      },
    },
  },
});