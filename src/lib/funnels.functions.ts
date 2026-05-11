import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { forwardLeadToExternalTool } from "./funnels.server";

let _admin: ReturnType<typeof createClient> | null = null;
function adminClient() {
  if (!_admin) {
    _admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  }
  return _admin;
}

// ──────────────────────────────────────────────────────────────────────
// Public — capture an email on a beat funnel landing page
// ──────────────────────────────────────────────────────────────────────
export const submitFunnelLead = createServerFn({ method: "POST" })
  .inputValidator((input: { slug: string; email: string }) =>
    z
      .object({
        slug: z.string().min(1).max(64).regex(/^[a-z0-9][a-z0-9-]{0,63}$/),
        email: z.string().email().max(254),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<{
    ok: boolean;
    download_url?: string;
    captured_at?: string;
    error?: string;
  }> => {
    const supabase = adminClient();

    const { data: rpc, error } = await supabase.rpc("capture_funnel_lead", {
      _slug: data.slug,
      _email: data.email,
      _ua: null,
      _ip: null,
    });
    if (error || !rpc) {
      return { ok: false, error: error?.message ?? "capture_failed" };
    }

    const result = rpc as { lead_id: string; captured_at: string; download_url: string; funnel_title: string };

    // Best-effort forward — don't block the user if it fails.
    void (async () => {
      const { data: beatRow } = await supabase
        .from("beat_funnels")
        .select("title, beats:beat_id(title)")
        .eq("slug", data.slug)
        .maybeSingle();
      const beatTitle = (beatRow as any)?.beats?.title ?? null;

      const fwd = await forwardLeadToExternalTool({
        email: data.email,
        funnel_slug: data.slug,
        funnel_title: result.funnel_title,
        beat_title: beatTitle,
        captured_at: result.captured_at,
      });
      await supabase.rpc("mark_funnel_lead_forwarded", {
        _lead_id: result.lead_id,
        _error: fwd.ok ? null : fwd.error ?? "unknown",
      });
    })();

    return { ok: true, download_url: result.download_url, captured_at: result.captured_at };
  });

// ──────────────────────────────────────────────────────────────────────
// Public — fetch funnel by slug (used by landing + offer pages)
// ──────────────────────────────────────────────────────────────────────
export const getFunnelBySlug = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) =>
    z.object({ slug: z.string().min(1).max(64).regex(/^[a-z0-9][a-z0-9-]{0,63}$/) }).parse(input),
  )
  .handler(async ({ data }) => {
    const supabase = adminClient();
    const { data: row, error } = await supabase
      .from("beat_funnels")
      .select("id, slug, title, headline, video_url, audio_url, cover_url, beat_id, is_active")
      .eq("slug", data.slug)
      .eq("is_active", true)
      .maybeSingle();
    if (error || !row) return { funnel: null as null };

    let beatAudio: string | null = null;
    let beatCover: string | null = null;
    let beatTitle: string | null = null;
    if ((row as any).beat_id) {
      const { data: b } = await supabase
        .from("beats")
        .select("audio_url_tagged, audio_url, cover_url, title")
        .eq("id", (row as any).beat_id)
        .maybeSingle();
      if (b) {
        beatAudio = (b as any).audio_url_tagged ?? (b as any).audio_url ?? null;
        beatCover = (b as any).cover_url ?? null;
        beatTitle = (b as any).title ?? null;
      }
    }

    return {
      funnel: {
        slug: (row as any).slug as string,
        title: (row as any).title as string,
        headline: (row as any).headline as string | null,
        video_url: (row as any).video_url as string | null,
        audio_url: ((row as any).audio_url as string | null) ?? beatAudio,
        cover_url: ((row as any).cover_url as string | null) ?? beatCover,
        beat_title: beatTitle,
      },
    };
  });
