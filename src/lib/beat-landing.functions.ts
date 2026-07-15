import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { type StripeEnv, createStripeClient, getStripeErrorMessage } from "@/lib/stripe.server";

let _admin: ReturnType<typeof createClient> | null = null;
function adminClient() {
  if (!_admin) {
    _admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  }
  return _admin;
}

export type BeatLanding = {
  id: string;
  landing_slug: string;
  title: string;
  producer_name: string | null;
  cover_url: string | null;
  audio_url_tagged: string | null;
  audio_url: string | null;
  price_cents: number;
  discount_price_cents: number;
  checkout_url: string | null;
  application_url: string | null;
  seo_title: string | null;
  seo_description: string | null;
  custom_video_url: string | null;
};

export type GlobalVideo = {
  video_url: string | null;
  contact_instagram: string | null;
  contact_email: string | null;
  contact_phone: string | null;
};

export const getBeatLandingBySlug = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) =>
    z.object({ slug: z.string().min(1).max(120) }).parse(input),
  )
  .handler(async ({ data }): Promise<{ beat: BeatLanding | null; global: GlobalVideo | null }> => {
    const sb = adminClient() as any;
    const [{ data: beat }, { data: global }] = await Promise.all([
      sb.from("beats")
        .select("id,landing_slug,title,producer_name,cover_url,audio_url_tagged,audio_url,price_cents,discount_price_cents,checkout_url,application_url,seo_title,seo_description,custom_video_url,is_landing_published,is_active")
        .eq("landing_slug", data.slug)
        .eq("is_landing_published", true)
        .eq("is_active", true)
        .maybeSingle(),
      sb.from("global_video")
        .select("video_url,contact_instagram,contact_email,contact_phone")
        .eq("id", 1)
        .maybeSingle(),
    ]);
    return {
      beat: (beat as BeatLanding | null) ?? null,
      global: (global as GlobalVideo | null) ?? null,
    };
  });

export const captureBeatLead = createServerFn({ method: "POST" })
  .inputValidator((input: { beatId: string; firstName: string; email: string }) =>
    z.object({
      beatId: z.string().uuid(),
      firstName: z.string().trim().min(1).max(80),
      email: z.string().trim().email().max(255),
    }).parse(input),
  )
  .handler(async ({ data }): Promise<{ ok: true; downloadUrl: string | null }> => {
    const sb = adminClient() as any;
    await sb.from("beat_lead_captures").insert({
      beat_id: data.beatId,
      first_name: data.firstName,
      email: data.email.toLowerCase(),
    });
    const { data: beat } = await sb.from("beats")
      .select("audio_url_tagged")
      .eq("id", data.beatId)
      .maybeSingle();
    return { ok: true, downloadUrl: (beat as { audio_url_tagged: string | null } | null)?.audio_url_tagged ?? null };
  });

export const checkDiscountEligibility = createServerFn({ method: "POST" })
  .inputValidator((input: { email: string }) =>
    z.object({ email: z.string().trim().email().max(255) }).parse(input),
  )
  .handler(async ({ data }): Promise<{ eligible: boolean }> => {
    const sb = adminClient() as any;
    const { data: rows } = await sb
      .from("lease_orders")
      .select("id")
      .eq("email", data.email.toLowerCase())
      .eq("used_first_time_discount", true)
      .limit(1);
    return { eligible: !rows || rows.length === 0 };
  });

export const recordLeaseIntent = createServerFn({ method: "POST" })
  .inputValidator((input: { beatId: string; email: string; useDiscount: boolean }) =>
    z.object({
      beatId: z.string().uuid(),
      email: z.string().trim().email().max(255),
      useDiscount: z.boolean(),
    }).parse(input),
  )
  .handler(async ({ data }): Promise<{ ok: boolean; error?: string; amountCents?: number; checkoutUrl?: string | null }> => {
    const sb = adminClient() as any;
    const { data: beat } = await sb
      .from("beats")
      .select("price_cents,discount_price_cents,checkout_url")
      .eq("id", data.beatId)
      .maybeSingle();
    if (!beat) return { ok: false, error: "Beat not found" };
    const b = beat as { price_cents: number; discount_price_cents: number; checkout_url: string | null };

    const email = data.email.toLowerCase();
    let useDiscount = data.useDiscount;
    if (useDiscount) {
      const { data: existing } = await sb
        .from("lease_orders")
        .select("id")
        .eq("email", email)
        .eq("used_first_time_discount", true)
        .limit(1);
      if (existing && existing.length > 0) {
        useDiscount = false;
      }
    }
    const amount = useDiscount ? b.discount_price_cents : b.price_cents;
    const { error } = await sb.from("lease_orders").insert({
      email,
      beat_id: data.beatId,
      amount_cents: amount,
      used_first_time_discount: useDiscount,
    });
    if (error) {
      // If discount uniqueness clashed, fall back to full price silently
      if (useDiscount) {
        await sb.from("lease_orders").insert({
          email,
          beat_id: data.beatId,
          amount_cents: b.price_cents,
          used_first_time_discount: false,
        });
        return { ok: true, amountCents: b.price_cents, checkoutUrl: b.checkout_url };
      }
      return { ok: false, error: error.message };
    }
    return { ok: true, amountCents: amount, checkoutUrl: b.checkout_url };
  });

// ---------- Admin ----------

async function assertAdmin(context: any) {
  const { data: ok } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!ok) throw new Error("Forbidden");
}

export const adminListBeats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const sb = adminClient() as any;
    const { data } = await sb.from("beats")
      .select("id,title,landing_slug,is_landing_published,price_cents,discount_price_cents,cover_url,producer_name,checkout_url,application_url,seo_title,seo_description,custom_video_url,audio_url_tagged,audio_url")
      // show all beats so admin can assign slugs
      .order("title", { ascending: true });
    return { beats: (data ?? []) as Array<Record<string, string | number | boolean | null>> };
  });

export const adminUpdateBeatLanding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    id: string;
    landing_slug?: string;
    price_cents?: number;
    discount_price_cents?: number;
    checkout_url?: string | null;
    application_url?: string | null;
    seo_title?: string | null;
    seo_description?: string | null;
    custom_video_url?: string | null;
    is_landing_published?: boolean;
    producer_name?: string | null;
  }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = adminClient() as any;
    const { id, ...updates } = data;
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(updates)) if (v !== undefined) clean[k] = v;
    if (typeof clean.landing_slug === "string") {
      clean.landing_slug = clean.landing_slug.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
    }
    const { error } = await sb.from("beats").update(clean).eq("id", id);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  });

export const adminGetGlobalVideo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const sb = adminClient() as any;
    const { data } = await sb.from("global_video").select("*").eq("id", 1).maybeSingle();
    return { global: data as GlobalVideo | null };
  });

export const adminUpdateGlobalVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    video_url?: string | null;
    contact_instagram?: string | null;
    contact_email?: string | null;
    contact_phone?: string | null;
  }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = adminClient() as any;
    const clean: Record<string, unknown> = { id: 1 };
    for (const [k, v] of Object.entries(data)) if (v !== undefined) clean[k] = v;
    const { error } = await sb.from("global_video").upsert(clean, { onConflict: "id" });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  });

export const adminListLeadCaptures = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const sb = adminClient() as any;
    const { data } = await sb.from("beat_lead_captures")
      .select("id,beat_id,first_name,email,created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    return { leads: (data ?? []) as Array<Record<string, string | number | boolean | null>> };
  });

export const adminListLeaseOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const sb = adminClient() as any;
    const { data } = await sb.from("lease_orders")
      .select("id,beat_id,email,amount_cents,used_first_time_discount,stripe_session_id,created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    return { orders: (data ?? []) as Array<Record<string, string | number | boolean | null>> };
  });

// ---------- Dynamic Stripe checkout for beat leases (hosted, redirect mode) ----------
// Creates a Checkout Session on the fly using price_data/product_data from the beat itself
// so no per-beat Stripe Payment Link is required.
export const createBeatLeaseCheckoutSession = createServerFn({ method: "POST" })
  .inputValidator((input: {
    beatId: string;
    email: string;
    useDiscount: boolean;
    environment: StripeEnv;
    successUrl: string;
    cancelUrl: string;
  }) =>
    z.object({
      beatId: z.string().uuid(),
      email: z.string().trim().email().max(255),
      useDiscount: z.boolean(),
      environment: z.enum(["sandbox", "live"]),
      successUrl: z.string().url().max(2048),
      cancelUrl: z.string().url().max(2048),
    }).parse(input),
  )
  .handler(async ({ data }): Promise<{ url: string | null; error: string | null }> => {
    const sb = adminClient() as any;
    const { data: beat } = await sb
      .from("beats")
      .select("id,title,landing_slug,price_cents,discount_price_cents,cover_url,producer_name")
      .eq("id", data.beatId)
      .maybeSingle();
    if (!beat) return { url: null, error: "Beat not found" };
    const b = beat as {
      id: string; title: string; landing_slug: string | null;
      price_cents: number; discount_price_cents: number;
      cover_url: string | null; producer_name: string | null;
    };

    const email = data.email.toLowerCase();
    let useDiscount = data.useDiscount;
    if (useDiscount) {
      const { data: existing } = await sb
        .from("lease_orders")
        .select("id")
        .eq("email", email)
        .eq("used_first_time_discount", true)
        .limit(1);
      if (existing && existing.length > 0) useDiscount = false;
    }
    const amount = useDiscount ? b.discount_price_cents : b.price_cents;
    if (!amount || amount < 50) return { url: null, error: "Beat price is not configured." };

    // Record intent (best-effort). Never block checkout on this.
    try {
      await sb.from("lease_orders").insert({
        email,
        beat_id: b.id,
        amount_cents: amount,
        used_first_time_discount: useDiscount,
      });
    } catch { /* ignore */ }

    try {
      const stripe = createStripeClient(data.environment);
      const description = `Beat Lease — ${b.title}`;
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [{
          price_data: {
            currency: "usd",
            unit_amount: amount,
            product_data: {
              name: description,
              ...(b.cover_url ? { images: [b.cover_url] } : {}),
            },
          },
          quantity: 1,
        }],
        customer_email: email,
        success_url: data.successUrl,
        cancel_url: data.cancelUrl,
        payment_intent_data: { description },
        metadata: {
          source: "beat_landing",
          beat_id: b.id,
          beat_slug: b.landing_slug ?? "",
          beat_title: b.title,
          license_type: "lease",
          buyer_email: email,
          used_first_time_discount: useDiscount ? "true" : "false",
        },
      });
      return { url: session.url ?? null, error: null };
    } catch (err) {
      return { url: null, error: getStripeErrorMessage(err) };
    }
  });

