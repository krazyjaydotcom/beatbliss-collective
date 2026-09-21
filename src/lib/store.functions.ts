import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

/**
 * Public storefront data access.
 *
 * Access rule is enforced HERE (server side), not by hiding rows in the client:
 * only `is_active` beats with `landing_visibility = 'public'` are ever returned.
 * Unlisted beats stay reachable only through their canonical /beats/$slug URL,
 * private beats stay unreachable. No untagged master URLs are returned — the
 * only audio field exposed is the tagged preview (falling back to the same
 * public preview file the existing beat pages already stream).
 */

export type StoreBeat = {
  id: string;
  title: string;
  slug: string | null;
  producerName: string;
  coverUrl: string | null;
  previewUrl: string | null;
  priceCents: number;
  nonExclusivePriceCents: number | null;
  trackoutPriceCents: number | null;
  exclusivePriceCents: number | null;
  bpm: number | null;
  genre: string | null;
  mood: string | null;
  musicKey: string | null;
  durationSeconds: number | null;
  createdAt: string;
  isFeatured: boolean;
};

export type StoreCatalog = {
  beats: StoreBeat[];
  producers: string[];
  genres: string[];
};

let _admin: ReturnType<typeof createClient> | null = null;
function adminClient() {
  if (!_admin) {
    _admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  }
  return _admin;
}

const UNKNOWN = new Set(["", "unknown", "n/a", "none", "-"]);
function clean(value: string | null | undefined): string | null {
  if (!value) return null;
  return UNKNOWN.has(value.trim().toLowerCase()) ? null : value.trim();
}

export const listStoreBeats = createServerFn({ method: "GET" }).handler(
  async (): Promise<StoreCatalog> => {
    const sb = adminClient() as any;
    const { data, error } = await sb
      .from("beats")
      .select(
        "id,title,landing_slug,producer_name,cover_url,audio_url,audio_url_tagged,price_cents,nonexclusive_price_cents,trackout_price_cents,exclusive_price_cents,bpm,genre,mood,music_key,duration_seconds,created_at,release_at,is_featured",
      )
      .eq("is_active", true)
      .eq("landing_visibility", "public")
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) throw new Error("The catalog could not be loaded.");

    const beats: StoreBeat[] = ((data ?? []) as Array<Record<string, any>>).map((b) => ({
      id: b.id,
      title: b.title,
      slug: b.landing_slug ?? null,
      producerName: clean(b.producer_name) ?? "KRAZYJAYDOTCOM",
      coverUrl: b.cover_url ?? null,
      previewUrl: b.audio_url_tagged ?? b.audio_url ?? null,
      priceCents: b.price_cents ?? 0,
      nonExclusivePriceCents:
        typeof b.nonexclusive_price_cents === "number" && b.nonexclusive_price_cents > 0
          ? b.nonexclusive_price_cents
          : null,
      exclusivePriceCents:
        typeof b.exclusive_price_cents === "number" && b.exclusive_price_cents > 0
          ? b.exclusive_price_cents
          : null,
      bpm: typeof b.bpm === "number" && b.bpm > 0 ? b.bpm : null,
      genre: clean(b.genre),
      mood: clean(b.mood),
      musicKey: clean(b.music_key),
      durationSeconds:
        typeof b.duration_seconds === "number" && b.duration_seconds > 0 ? b.duration_seconds : null,
      createdAt: b.release_at ?? b.created_at,
      isFeatured: Boolean(b.is_featured),
    }));

    const genres = Array.from(new Set(beats.map((b) => b.genre).filter(Boolean) as string[])).sort(
      (a, b) => a.localeCompare(b),
    );
    const producers = Array.from(new Set(beats.map((b) => b.producerName))).sort((a, b) =>
      a.localeCompare(b),
    );

    return { beats, producers, genres };
  },
);
