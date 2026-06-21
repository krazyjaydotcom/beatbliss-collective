import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Beat = {
  id: string;
  title: string;
  producer_name: string | null;
  genre: string | null;
  mood: string | null;
  bpm: number | null;
  duration_seconds: number | null;
  cover_url: string | null;
  audio_url_tagged: string | null;
};

let _client: ReturnType<typeof createClient<Database>> | null = null;
function publicClient() {
  if (!_client) {
    _client = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );
  }
  return _client;
}

export const getHomePlayerQueue = createServerFn({ method: "GET" })
  .inputValidator((input: { beatId?: string | null }) =>
    z.object({ beatId: z.string().uuid().nullable().optional() }).parse(input),
  )
  .handler(async ({ data }): Promise<{ featured: Beat | null; queue: Beat[] }> => {
    const supabase = publicClient();
    const { data: rows, error } = await (supabase.rpc as any)("list_claimable_beats");
    if (error || !rows) return { featured: null, queue: [] };

    const all: Beat[] = (rows as any[]).map((b) => ({
      id: b.id,
      title: b.title,
      producer_name: b.producer_name,
      genre: b.genre,
      mood: b.mood,
      bpm: b.bpm,
      duration_seconds: b.duration_seconds,
      cover_url: b.cover_url,
      audio_url_tagged: b.audio_url_tagged ?? b.audio_url ?? null,
    }));

    const featured = data.beatId ? all.find((b) => b.id === data.beatId) ?? null : null;
    const others = all.filter((b) => b.id !== featured?.id).slice(0, 4);
    return { featured, queue: featured ? [featured, ...others] : all.slice(0, 5) };
  });
