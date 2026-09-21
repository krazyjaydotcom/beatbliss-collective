import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { type StripeEnv, createStripeClient, getStripeErrorMessage } from "@/lib/stripe.server";
import { slugifyTitle } from "@/lib/slug";


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
  custom_video_recorded_at: string | null;
  bpm: number | null;
  genre: string | null;
  mood: string | null;
};

export type LandingVisibility = "public" | "unlisted" | "private";


export type GlobalVideo = {
  video_url: string | null;
  contact_instagram: string | null;
  contact_email: string | null;
  contact_phone: string | null;
};

export type BeatAttachment = {
  id: string;
  filename: string;
  mime_type: string | null;
  size_bytes: number | null;
  download_url: string;
};

export type InquiryQuestion = {
  id: string;
  label: string;
  placeholder: string | null;
  field_type: string;
  required: boolean;
  sort_order: number;
};

export type EmailStatusRow = {
  message_id: string;
  template_name: string;
  recipient_email: string;
  status: string;
  error_message: string | null;
  created_at: string;
};

export const getBeatLandingBySlug = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) =>
    z.object({ slug: z.string().min(1).max(120) }).parse(input),
  )
  .handler(async ({ data }): Promise<{ beat: BeatLanding | null; global: GlobalVideo | null; attachments: BeatAttachment[] }> => {
    const sb = adminClient() as any;
    const [{ data: beat }, { data: global }] = await Promise.all([
      sb.from("beats")
        .select("id,landing_slug,title,producer_name,cover_url,audio_url_tagged,audio_url,price_cents,discount_price_cents,checkout_url,application_url,seo_title,seo_description,custom_video_url,custom_video_recorded_at,bpm,genre,mood,is_landing_published,is_active")

        .eq("landing_slug", data.slug)
        .neq("landing_visibility", "private")
        .eq("is_active", true)
        .maybeSingle(),
      sb.from("global_video")
        .select("video_url,contact_instagram,contact_email,contact_phone")
        .eq("id", 1)
        .maybeSingle(),
    ]);
    let attachments: BeatAttachment[] = [];
    if (beat?.id) {
      const { data: atts } = await sb.from("beat_landing_attachments")
        .select("id,filename,mime_type,size_bytes,sort_order")
        .eq("beat_id", beat.id)
        .order("sort_order", { ascending: true });
      attachments = ((atts ?? []) as Array<{ id: string; filename: string; mime_type: string | null; size_bytes: number | null }>).map((a) => ({
        id: a.id,
        filename: a.filename,
        mime_type: a.mime_type,
        size_bytes: a.size_bytes,
        download_url: `/api/public/beat-attachment?id=${encodeURIComponent(a.id)}`,
      }));
    }
    return {
      beat: (beat as BeatLanding | null) ?? null,
      global: (global as GlobalVideo | null) ?? null,
      attachments,
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
      .select("title,landing_slug,audio_url,audio_url_tagged")
      .eq("id", data.beatId)
      .maybeSingle();
    const b = beat as { title: string; landing_slug: string | null; audio_url: string | null; audio_url_tagged: string | null } | null;
    // Prefer normal MP3 (audio_url), fall back to tagged version if that's all we have.
    const downloadUrl = b?.audio_url ?? b?.audio_url_tagged ?? null;

    // Fire-and-forget email — never block the response if email queue is missing.
    if (downloadUrl && b) {
      try {
        const { queueFreeDownloadEmail } = await import("@/lib/beat-landing-email.server");
        await queueFreeDownloadEmail({
          to: data.email.toLowerCase(),
          firstName: data.firstName,
          beatTitle: b.title,
          downloadUrl,
          beatSlug: b.landing_slug,
        });
      } catch (err) {
        console.error("[captureBeatLead] failed to queue email", err);
      }
    }
    return { ok: true, downloadUrl };
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
      license_tier: "unlimited",
    });
    if (error) {
      // If discount uniqueness clashed, fall back to full price silently
      if (useDiscount) {
        await sb.from("lease_orders").insert({
          email,
          beat_id: data.beatId,
          amount_cents: b.price_cents,
          used_first_time_discount: false,
          license_tier: "unlimited",
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
    // Auto-backfill: any active beat missing a landing_slug gets one derived from its title.
    const { data: missing } = await sb.from("beats")
      .select("id,title")
      .is("landing_slug", null);
    const rowsMissing = (missing ?? []) as Array<{ id: string; title: string }>;
    if (rowsMissing.length > 0) {
      const used = new Set<string>();
      const { data: existingSlugs } = await sb.from("beats")
        .select("landing_slug")
        .not("landing_slug", "is", null);
      for (const r of (existingSlugs ?? []) as Array<{ landing_slug: string | null }>) {
        if (r.landing_slug) used.add(r.landing_slug);
      }
      for (const row of rowsMissing) {
        const base = slugifyTitle(row.title || "beat") || "beat";
        let candidate = base;
        let n = 2;
        while (used.has(candidate)) candidate = `${base}-${n++}`;
        used.add(candidate);
        await sb.from("beats").update({ landing_slug: candidate }).eq("id", row.id);
      }
    }
    const { data } = await sb.from("beats")
      .select("id,title,landing_slug,landing_visibility,is_landing_published,is_active,price_cents,discount_price_cents,cover_url,producer_name,checkout_url,application_url,seo_title,seo_description,custom_video_url,custom_video_recorded_at,audio_url_tagged,audio_url,nonexclusive_price_cents,trackout_price_cents,exclusive_price_cents")
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
    custom_video_recorded_at?: string | null;
    is_landing_published?: boolean;
    landing_visibility?: LandingVisibility;
    producer_name?: string | null;
    nonexclusive_price_cents?: number | null;
    trackout_price_cents?: number | null;
    exclusive_price_cents?: number | null;
  }) => z.object({
    id: z.string().uuid(),
    landing_slug: z.string().max(120).optional(),
    price_cents: z.number().int().min(0).max(10_000_000).optional(),
    discount_price_cents: z.number().int().min(0).max(10_000_000).optional(),
    checkout_url: z.string().max(2048).nullable().optional(),
    application_url: z.string().max(2048).nullable().optional(),
    seo_title: z.string().max(120).nullable().optional(),
    seo_description: z.string().max(500).nullable().optional(),
    custom_video_url: z.string().max(2048).nullable().optional(),
    custom_video_recorded_at: z.string().datetime().nullable().optional(),
    is_landing_published: z.boolean().optional(),
    landing_visibility: z.enum(["public", "unlisted", "private"]).optional(),
    producer_name: z.string().max(160).nullable().optional(),
    nonexclusive_price_cents: z.number().int().min(0).max(10_000_000).nullable().optional(),
    trackout_price_cents: z.number().int().min(0).max(10_000_000).nullable().optional(),
    exclusive_price_cents: z.number().int().min(0).max(10_000_000).nullable().optional(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = adminClient() as any;
    const { id, ...updates } = data;
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(updates)) if (v !== undefined) clean[k] = v;
    if (data.landing_visibility) {
      clean.is_landing_published = data.landing_visibility !== "private";
    } else if (typeof data.is_landing_published === "boolean") {
      clean.landing_visibility = data.is_landing_published ? "public" : "private";
    }
    if (typeof clean.landing_slug === "string") {
      const cleaned = clean.landing_slug.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
      if (cleaned) {
        clean.landing_slug = cleaned;
      } else {
        // Empty slug submitted — derive from beat title so admin isn't forced to type one.
        const { data: b } = await sb.from("beats").select("title,landing_slug").eq("id", id).maybeSingle();
        const existing = (b as { title: string; landing_slug: string | null } | null);
        if (existing?.landing_slug) {
          delete clean.landing_slug; // don't overwrite existing slug with empty
        } else if (existing?.title) {
          clean.landing_slug = slugifyTitle(existing.title);
        } else {
          delete clean.landing_slug;
        }
      }
    }
    if (clean.landing_visibility !== "private" && !clean.landing_slug) {
      const { data: current } = await sb.from("beats").select("title,landing_slug").eq("id", id).maybeSingle();
      if (!current?.landing_slug && current?.title) {
        const base = slugifyTitle(current.title) || "beat";
        let candidate = base;
        let suffix = 2;
        while (true) {
          const { data: collision } = await sb.from("beats").select("id").eq("landing_slug", candidate).neq("id", id).maybeSingle();
          if (!collision) break;
          candidate = `${base}-${suffix++}`;
        }
        clean.landing_slug = candidate;
      }
    }
    const { error } = await sb.from("beats").update(clean).eq("id", id);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  });

export const adminBulkUpdateLandingPrices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    price_cents: number;
    discount_price_cents?: number | null;
    target: "published" | "all";
  }) =>
    z.object({
      price_cents: z.number().int().min(50).max(10_000_000),
      discount_price_cents: z.number().int().min(0).max(10_000_000).nullable().optional(),
      target: z.enum(["published", "all"]),
    }).parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: boolean; updated: number; error?: string }> => {
    await assertAdmin(context);
    const sb = adminClient() as any;
    const patch: Record<string, unknown> = { price_cents: data.price_cents };
    if (data.discount_price_cents !== undefined && data.discount_price_cents !== null) {
      patch.discount_price_cents = data.discount_price_cents;
    }
    let query = sb.from("beats").update(patch).select("id");
    if (data.target === "published") {
      query = query.eq("is_landing_published", true);
    } else {
      // PostgREST requires a filter on update; match every row explicitly.
      query = query.not("id", "is", null);
    }
    const { data: rows, error } = await query;
    if (error) return { ok: false, updated: 0, error: error.message };
    return { ok: true, updated: (rows as Array<unknown> | null)?.length ?? 0 };
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
      .select("id,beat_id,email,amount_cents,license_tier,used_first_time_discount,stripe_session_id,created_at")
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
        license_tier: "unlimited",
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


// ---------- Inquiry questions (public read + admin manage) ----------

export const listInquiryQuestions = createServerFn({ method: "GET" })
  .handler(async (): Promise<{ questions: InquiryQuestion[] }> => {
    const sb = adminClient() as any;
    const { data } = await sb.from("beat_landing_inquiry_questions")
      .select("id,label,placeholder,field_type,required,sort_order")
      .eq("active", true)
      .order("sort_order", { ascending: true });
    return { questions: (data ?? []) as InquiryQuestion[] };
  });

export const submitBeatInquiry = createServerFn({ method: "POST" })
  .inputValidator((input: { beatId?: string | null; name: string; email: string; answers: Record<string, string> }) =>
    z.object({
      beatId: z.string().uuid().nullable().optional(),
      name: z.string().trim().min(1).max(200),
      email: z.string().trim().email().max(255),
      answers: z.record(z.string(), z.string().max(4000)),
    }).parse(input),
  )
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const sb = adminClient() as any;
    const { data: row } = await sb.from("beat_landing_inquiries").insert({
      beat_id: data.beatId ?? null,
      name: data.name,
      email: data.email.toLowerCase(),
      answers: data.answers,
    }).select("id").maybeSingle();

    // resolve beat title if provided
    let beatTitle: string | null = null;
    let beatSlug: string | null = null;
    if (data.beatId) {
      const { data: b } = await sb.from("beats").select("title,landing_slug").eq("id", data.beatId).maybeSingle();
      if (b) { beatTitle = b.title; beatSlug = b.landing_slug; }
    }

    // labels for the email
    const { data: qs } = await sb.from("beat_landing_inquiry_questions")
      .select("id,label,sort_order").order("sort_order", { ascending: true });
    const labels: Record<string, string> = {};
    for (const q of (qs ?? []) as Array<{ id: string; label: string }>) labels[q.id] = q.label;

    try {
      const { queueExclusiveInquiryEmail } = await import("@/lib/beat-landing-email.server");
      await queueExclusiveInquiryEmail({
        submissionId: (row?.id as string) ?? `${Date.now()}`,
        name: data.name,
        email: data.email.toLowerCase(),
        beatTitle,
        beatSlug,
        answers: data.answers,
        labels,
      });
    } catch (err) {
      console.error("[submitBeatInquiry] email queue failed", err);
    }

    return { ok: true };
  });

export const adminListInquiryQuestions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const sb = adminClient() as any;
    const { data } = await sb.from("beat_landing_inquiry_questions")
      .select("*")
      .order("sort_order", { ascending: true });
    return { questions: (data ?? []) as any[] };
  });

export const adminUpsertInquiryQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id?: string; label: string; placeholder?: string | null; field_type?: string; required?: boolean; sort_order?: number; active?: boolean }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = adminClient() as any;
    const payload: Record<string, unknown> = {
      label: data.label,
      placeholder: data.placeholder ?? null,
      field_type: data.field_type ?? "text",
      required: data.required ?? true,
      sort_order: data.sort_order ?? 0,
      active: data.active ?? true,
    };
    if (data.id) {
      const { error } = await sb.from("beat_landing_inquiry_questions").update(payload).eq("id", data.id);
      if (error) return { ok: false, error: error.message };
    } else {
      const { error } = await sb.from("beat_landing_inquiry_questions").insert(payload);
      if (error) return { ok: false, error: error.message };
    }
    return { ok: true };
  });

export const adminDeleteInquiryQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = adminClient() as any;
    const { error } = await sb.from("beat_landing_inquiry_questions").delete().eq("id", data.id);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  });

export const adminListInquirySubmissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const sb = adminClient() as any;
    const { data } = await sb.from("beat_landing_inquiries")
      .select("id,beat_id,name,email,answers,created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    return { submissions: (data ?? []) as any[] };
  });

// ---------- Attachments (admin manage, public list via loader) ----------

export const adminListAttachments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { beatId: string }) => z.object({ beatId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = adminClient() as any;
    const { data: rows } = await sb.from("beat_landing_attachments")
      .select("id,filename,mime_type,size_bytes,sort_order,storage_path")
      .eq("beat_id", data.beatId)
      .order("sort_order", { ascending: true });
    return { attachments: (rows ?? []) as any[] };
  });

export const adminCreateAttachment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { beatId: string; storage_path: string; filename: string; mime_type?: string | null; size_bytes?: number | null; sort_order?: number }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = adminClient() as any;
    const { error } = await sb.from("beat_landing_attachments").insert({
      beat_id: data.beatId,
      storage_path: data.storage_path,
      filename: data.filename,
      mime_type: data.mime_type ?? null,
      size_bytes: data.size_bytes ?? null,
      sort_order: data.sort_order ?? 0,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  });

export const adminDeleteAttachment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = adminClient() as any;
    const { data: row } = await sb.from("beat_landing_attachments").select("storage_path").eq("id", data.id).maybeSingle();
    if (row?.storage_path) {
      try { await sb.storage.from("beat-attachments").remove([row.storage_path as string]); } catch { /* ignore */ }
    }
    await sb.from("beat_landing_attachments").delete().eq("id", data.id);
    return { ok: true };
  });

// ---------- Admin: send test emails ----------

const EMAIL_STATUS_LABELS = [
  "beat_free_download",
  "beat_purchase_buyer",
  "beat_purchase_admin",
  "beat_exclusive_inquiry",
  "invite_claim",
];

export const adminListEmailStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ emails: EmailStatusRow[]; stats: { total: number; sent: number; failed: number; pending: number; suppressed: number } }> => {
    await assertAdmin(context);
    const sb = adminClient() as any;
    const { data, error } = await sb
      .from("email_send_log")
      .select("message_id,template_name,recipient_email,status,error_message,created_at")
      .in("template_name", EMAIL_STATUS_LABELS)
      .not("message_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(250);
    if (error) throw new Error(error.message);

    const seen = new Set<string>();
    const emails: EmailStatusRow[] = [];
    for (const row of (data ?? []) as EmailStatusRow[]) {
      if (!row.message_id || seen.has(row.message_id)) continue;
      seen.add(row.message_id);
      emails.push(row);
      if (emails.length >= 50) break;
    }

    const stats = emails.reduce(
      (acc, row) => {
        acc.total += 1;
        if (row.status === "sent") acc.sent += 1;
        else if (row.status === "pending") acc.pending += 1;
        else if (row.status === "suppressed") acc.suppressed += 1;
        else if (row.status === "failed" || row.status === "dlq") acc.failed += 1;
        return acc;
      },
      { total: 0, sent: 0, failed: 0, pending: 0, suppressed: 0 },
    );

    return { emails, stats };
  });

export const adminSendTestEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { to: string; kind: "free_download" | "purchase_buyer" | "admin_sale" | "exclusive_inquiry" }) =>
    z.object({
      to: z.string().trim().email().max(255),
      kind: z.enum(["free_download", "purchase_buyer", "admin_sale", "exclusive_inquiry"]),
    }).parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: boolean; error?: string; messageId?: string; status?: string }> => {
    await assertAdmin(context);
    const email = await import("@/lib/beat-landing-email.server");
    const sb = adminClient() as any;
    const to = data.to.toLowerCase();
    const stamp = Date.now();
    try {
      let messageId: string | undefined;
      if (data.kind === "free_download") {
        const result = await email.queueFreeDownloadEmail({
          to, firstName: "Test",
          beatTitle: "Test Beat", downloadUrl: "https://mybeatcatalog.com/",
          beatSlug: `test-${stamp}`,
        });
        messageId = result.messageId;
      } else if (data.kind === "purchase_buyer") {
        const result = await email.queueBuyerPurchaseEmail({
          to, beatTitle: "Test Beat",
          downloadUrl: "https://mybeatcatalog.com/", amountCents: 4999,
          sessionId: `test_buyer_${stamp}`, beatSlug: `test-${stamp}`,
        });
        messageId = result.messageId;
      } else if (data.kind === "admin_sale") {
        const result = await email.queueAdminSaleEmail({
          beatTitle: "Test Beat", buyerEmail: to,
          amountCents: 4999, sessionId: `test_admin_${stamp}`, beatSlug: `test-${stamp}`,
          overrideRecipient: to,
        });
        messageId = result.messageId;
      } else {
        const result = await email.queueExclusiveInquiryEmail({
          submissionId: `test_inq_${stamp}`,
          name: "Test Sender",
          email: to,
          beatTitle: "Test Beat",
          beatSlug: `test-${stamp}`,
          answers: { q1: "Sample answer 1", q2: "Sample answer 2" },
          labels: { q1: "What kind of project?", q2: "Budget range" },
          overrideRecipient: to,
        });
        messageId = result.messageId;
      }
      const { data: latest } = messageId
        ? await sb.from("email_send_log").select("status").eq("message_id", messageId).order("created_at", { ascending: false }).limit(1).maybeSingle()
        : { data: null };
      return { ok: true, messageId, status: latest?.status || "pending" };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Failed" };
    }
  });

export const adminBulkEnableLandingSlugs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { ids: string[]; visibility: LandingVisibility }) =>
    z.object({
      ids: z.array(z.string().uuid()).min(1).max(500),
      visibility: z.enum(["public", "unlisted", "private"]),
    }).parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: boolean; updated: number; slugsAssigned: number; error?: string }> => {
    await assertAdmin(context);
    const sb = adminClient() as any;

    const { data: rows } = await sb.from("beats")
      .select("id,title,landing_slug")
      .in("id", data.ids);
    const beats = (rows ?? []) as Array<{ id: string; title: string; landing_slug: string | null }>;

    const used = new Set<string>();
    const { data: existingSlugs } = await sb.from("beats")
      .select("landing_slug")
      .not("landing_slug", "is", null);
    for (const r of (existingSlugs ?? []) as Array<{ landing_slug: string | null }>) {
      if (r.landing_slug) used.add(r.landing_slug);
    }

    let slugsAssigned = 0;
    let updated = 0;
    for (const b of beats) {
      const patch: Record<string, unknown> = {
        landing_visibility: data.visibility,
        is_landing_published: data.visibility !== "private",
      };
      if (data.visibility !== "private" && !b.landing_slug) {
        const base = slugifyTitle(b.title || "beat") || "beat";
        let candidate = base;
        let n = 2;
        while (used.has(candidate)) candidate = `${base}-${n++}`;
        used.add(candidate);
        patch.landing_slug = candidate;
        slugsAssigned++;
      }
      const { error } = await sb.from("beats").update(patch).eq("id", b.id);
      if (!error) updated++;
    }
    return { ok: true, updated, slugsAssigned };
  });
