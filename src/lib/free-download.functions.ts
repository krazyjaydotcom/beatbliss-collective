import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

/**
 * Data + lead capture for the public "free download" landing pages
 * (mybeatcatalog.com/free/<beat-slug>).
 *
 * The page mixes the producer's voice tag into the beat in the visitor's
 * browser before handing over the file, so no untagged master is ever offered
 * as a free download. The audio URL returned here is the same public preview
 * file the storefront already streams.
 */

let _admin: ReturnType<typeof createClient> | null = null;
function adminClient() {
  if (!_admin) {
    _admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  }
  return _admin;
}

export type FreeDownloadBeat = {
  id: string;
  title: string;
  slug: string;
  producerName: string;
  coverUrl: string | null;
  previewUrl: string | null;
  priceCents: number;
  nonExclusivePriceCents: number | null;
  trackoutPriceCents: number | null;
  bpm: number | null;
  genre: string | null;
  musicKey: string | null;
};

export type FreeDownloadTag = {
  tagUrl: string | null;
  intervalSeconds: number;
  startOffsetSeconds: number;
  volume: number;
};

export const getFreeDownloadBeat = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) =>
    z.object({ slug: z.string().min(1).max(160) }).parse(input),
  )
  .handler(async ({ data }): Promise<{ beat: FreeDownloadBeat | null; tag: FreeDownloadTag }> => {
    const sb = adminClient() as any;
    const [{ data: row }, { data: tagRow }] = await Promise.all([
      sb
        .from("beats")
        .select(
          "id,title,landing_slug,producer_name,cover_url,audio_url,audio_url_tagged,price_cents,nonexclusive_price_cents,trackout_price_cents,bpm,genre,music_key,is_active,landing_visibility",
        )
        .eq("landing_slug", data.slug)
        .eq("is_active", true)
        .neq("landing_visibility", "private")
        .maybeSingle(),
      sb
        .from("audio_tag_settings")
        .select("tag_url,is_enabled,interval_seconds,start_offset_seconds,volume")
        .eq("id", 1)
        .maybeSingle(),
    ]);

    const tag: FreeDownloadTag = {
      tagUrl: tagRow?.is_enabled ? (tagRow.tag_url ?? null) : null,
      intervalSeconds: Math.max(5, Number(tagRow?.interval_seconds) || 40),
      startOffsetSeconds: Math.max(0, Number(tagRow?.start_offset_seconds) || 0),
      volume: Math.min(1, Math.max(0, Number(tagRow?.volume) || 0.7)),
    };

    if (!row) return { beat: null, tag };

    const num = (v: unknown) => (typeof v === "number" && v > 0 ? v : null);

    return {
      beat: {
        id: row.id,
        title: row.title,
        slug: row.landing_slug,
        producerName: row.producer_name?.trim() || "KRAZYJAYDOTCOM",
        coverUrl: row.cover_url ?? null,
        previewUrl: row.audio_url_tagged ?? row.audio_url ?? null,
        priceCents: row.price_cents ?? 0,
        nonExclusivePriceCents: num(row.nonexclusive_price_cents),
        trackoutPriceCents: num(row.trackout_price_cents),
        bpm: row.bpm ?? null,
        genre: row.genre ?? null,
        musicKey: row.music_key ?? null,
      },
      tag,
    };
  });

export const captureFreeDownloadLead = createServerFn({ method: "POST" })
  .inputValidator((input: { beatId: string; email: string; firstName?: string; hp?: string }) =>
    z
      .object({
        beatId: z.string().uuid(),
        email: z.string().trim().email().max(255),
        firstName: z.string().trim().max(80).optional(),
        hp: z.string().max(200).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    // Honeypot: real visitors never fill this field.
    if (data.hp && data.hp.trim().length > 0) return { ok: true };

    const sb = adminClient() as any;
    const email = data.email.toLowerCase();

    const { data: beat } = await sb
      .from("beats")
      .select("title,landing_slug")
      .eq("id", data.beatId)
      .maybeSingle();
    if (!beat) return { ok: false };

    // first_name is NOT NULL on this table and the free page only asks for an
    // email, so store an empty string rather than failing the capture.
    const { error: insertError } = await sb.from("beat_lead_captures").insert({
      beat_id: data.beatId,
      first_name: data.firstName?.trim() || "",
      email,
    });
    if (insertError) {
      console.error("[captureFreeDownloadLead] insert failed", insertError);
      return { ok: false };
    }

    try {
      const { queueFreeDownloadEmail } = await import("@/lib/beat-landing-email.server");
      await queueFreeDownloadEmail({
        to: email,
        firstName: data.firstName?.trim() || "there",
        beatTitle: beat.title,
        // Point back at the page that renders the tagged file, never a master URL.
        downloadUrl: `https://mybeatcatalog.com/free/${beat.landing_slug ?? ""}`,
        beatSlug: beat.landing_slug,
      });
    } catch (err) {
      console.error("[captureFreeDownloadLead] email failed", err);
    }

    return { ok: true };
  });
