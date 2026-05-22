import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function slugify(value: string) {
  return value.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "") || "beat";
}

export const Route = createFileRoute("/api/public/download-beat")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const token = url.searchParams.get("token")?.trim();
        if (!token) return new Response("Missing token", { status: 400 });

        const { data: offerRows, error: offerErr } = await (supabaseAdmin as any).rpc(
          "get_beat_offer",
          { _token: token },
        );
        if (offerErr) return new Response("Lookup failed", { status: 500 });
        const offer = Array.isArray(offerRows) ? offerRows[0] : offerRows;
        if (!offer) return new Response("Offer not found", { status: 404 });

        if (offer.expires_at && new Date(offer.expires_at).getTime() < Date.now()) {
          return new Response("Offer expired", { status: 410 });
        }

        const audioUrl: string | null = offer.audio_url_tagged ?? offer.audio_url ?? null;
        if (!audioUrl) return new Response("No audio available", { status: 404 });

        const fileName = `MYBEATCATALOG_${slugify(offer.title || "beat")}.mp3`;

        // Proxy/stream so Content-Disposition forces download (works in Instagram in-app browser)
        const upstream = await fetch(audioUrl);
        if (!upstream.ok || !upstream.body) {
          return new Response("Failed to fetch audio", { status: 502 });
        }

        const headers = new Headers();
        headers.set(
          "Content-Type",
          upstream.headers.get("content-type") || "audio/mpeg",
        );
        const len = upstream.headers.get("content-length");
        if (len) headers.set("Content-Length", len);
        headers.set(
          "Content-Disposition",
          `attachment; filename="${fileName}"`,
        );
        headers.set("Cache-Control", "private, no-store");

        return new Response(upstream.body, { status: 200, headers });
      },
    },
  },
});
