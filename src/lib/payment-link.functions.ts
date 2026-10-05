import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export type PaymentLinkBeat = {
  id: string;
  title: string;
  coverUrl: string | null;
  priceCents: number | null;
  nonExclusivePriceCents: number | null;
  trackoutPriceCents: number | null;
};

// A payment link can include public or unlisted beats, never private beats.
// Only purchase-facing fields leave this function; master audio/file URLs do not.
export const getPaymentLinkBeat = createServerFn({ method: "GET" })
  .inputValidator((input: { beatRef: string }) =>
    z.object({ beatRef: z.string().min(1).max(120).regex(/^[a-zA-Z0-9_-]+$/) }).parse(input),
  )
  .handler(async ({ data }): Promise<PaymentLinkBeat | null> => {
    const sb = createClient(process.env['SUPABASE_URL']!, process.env['SUPABASE_SERVICE_ROLE_KEY']!);
    const fields = "id,title,cover_url,price_cents,nonexclusive_price_cents,trackout_price_cents";
    const column = /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(data.beatRef) ? "id" : "landing_slug";
    const { data: beat, error } = await sb.from("beats")
      .select(fields)
      .eq(column, data.beatRef)
      .eq("is_active", true)
      .in("landing_visibility", ["public", "unlisted"])
      .maybeSingle();
    if (error) throw new Error("This beat could not be loaded.");
    if (!beat) return null;
    return {
      id: beat.id,
      title: beat.title,
      coverUrl: beat.cover_url,
      priceCents: beat.price_cents,
      nonExclusivePriceCents: beat.nonexclusive_price_cents,
      trackoutPriceCents: beat.trackout_price_cents,
    };
  });