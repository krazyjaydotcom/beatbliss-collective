import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { slugifyTitle } from "@/lib/slug";

const SITE = "https://mybeatcatalog.com";

function normalizeMatch(value: string): string {
  return slugifyTitle(value);
}

export const Route = createFileRoute("/api/public/beat-lookup")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const title = url.searchParams.get("title")?.trim();
        if (!title) return new Response("Missing title", { status: 400 });

        const target = normalizeMatch(title);
        if (!target) return new Response("Invalid title", { status: 400 });

        const { data: beats, error: beatsError } = await (supabaseAdmin as any)
          .from("beats")
          .select("id, title, landing_slug, bpm, genre, mood, music_key, producer_name, is_active, landing_visibility")
          .eq("is_active", true)
          .eq("landing_visibility", "public");

        if (beatsError || !beats) {
          return new Response("Catalog lookup failed", { status: 500 });
        }

        let beat = (beats as Array<Record<string, any>>).find(
          (b) => normalizeMatch(b.title) === target,
        );
        if (!beat) {
          beat = beats.find((b: any) => b.title.toLowerCase().includes(title.toLowerCase()));
        }
        if (!beat) {
          beat = beats.find((b: any) => title.toLowerCase().includes(b.title.toLowerCase()));
        }
        if (!beat) {
          return new Response(JSON.stringify(null), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        const beatSlug = beat.landing_slug || slugifyTitle(beat.title);
        const beatPageUrl = `${SITE}/beats/${beatSlug}`;

        const { data: funnels } = await (supabaseAdmin as any)
          .from("beat_funnels")
          .select("slug, download_url")
          .eq("beat_id", beat.id)
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(1);

        const funnel = (funnels ?? [])[0] as { slug: string; download_url: string } | undefined;
        const purchaseUrl = funnel ? `${SITE}/b/${funnel.slug}` : beatPageUrl;
        const downloadUrl = funnel?.download_url ?? undefined;

        return new Response(
          JSON.stringify({
            title: beat.title as string,
            slug: beatSlug,
            purchaseUrl,
            beatPageUrl,
            downloadUrl,
            bpm: beat.bpm ?? null,
            genre: beat.genre ?? null,
            mood: beat.mood ?? null,
            musicKey: beat.music_key ?? null,
            producerName: beat.producer_name ?? null,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
