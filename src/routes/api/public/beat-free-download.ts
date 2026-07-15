import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function slugify(value: string) {
  return value.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "") || "beat";
}

export const Route = createFileRoute("/api/public/beat-free-download")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const beatId = url.searchParams.get("beatId")?.trim();
        if (!beatId) return new Response("Missing beatId", { status: 400 });

        const { data: beat, error } = await (supabaseAdmin as any)
          .from("beats")
          .select("title, audio_url, audio_url_tagged, is_landing_published, is_active")
          .eq("id", beatId)
          .maybeSingle();
        if (error) return new Response("Lookup failed", { status: 500 });
        if (!beat) return new Response("Beat not found", { status: 404 });
        if (!beat.is_active) return new Response("Beat unavailable", { status: 404 });

        // Prefer clean MP3; fall back to tagged.
        const audioUrl: string | null = beat.audio_url ?? beat.audio_url_tagged ?? null;
        if (!audioUrl) return new Response("No audio available", { status: 404 });

        const fileName = `MYBEATCATALOG_${slugify(beat.title || "beat")}.mp3`;
        const upstream = await fetch(audioUrl);
        if (!upstream.ok || !upstream.body) {
          return new Response("Failed to fetch audio", { status: 502 });
        }

        const headers = new Headers();
        headers.set("Content-Type", upstream.headers.get("content-type") || "audio/mpeg");
        const len = upstream.headers.get("content-length");
        if (len) headers.set("Content-Length", len);
        headers.set("Content-Disposition", `attachment; filename="${fileName}"`);
        headers.set("Cache-Control", "private, no-store");

        return new Response(upstream.body, { status: 200, headers });
      },
    },
  },
});
