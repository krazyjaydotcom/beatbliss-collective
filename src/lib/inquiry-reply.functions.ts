import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Admin-only personal replies to a specific prior inquiry.
 * The recipient is always loaded server-side from the inquiry row — never taken from the browser.
 * One inquiry → one recipient. No lists, no promotional sends.
 */
const SOURCES = ["beat_landing_inquiries", "access_applications"] as const;

async function assertAdmin(context: any) {
  const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!data) throw new Error("Forbidden");
}

export const adminListInquiries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const sb = (context as any).supabase;
    const [a, b, r] = await Promise.all([
      sb.from("beat_landing_inquiries").select("id, name, email, created_at, beats(title)").order("created_at", { ascending: false }).limit(100),
      sb.from("access_applications").select("id, name, email, created_at, beat_title").not("email", "is", null).order("created_at", { ascending: false }).limit(100),
      sb.from("inquiry_replies").select("source_table, source_id, status, created_at").order("created_at", { ascending: false }).limit(500),
    ]);
    const last = new Map<string, { status: string; at: string }>();
    for (const x of r.data ?? []) {
      const k = `${x.source_table}:${x.source_id}`;
      if (!last.has(k)) last.set(k, { status: x.status, at: x.created_at });
    }
    const rows = [
      ...(a.data ?? []).map((x: any) => ({ source: "beat_landing_inquiries" as const, id: x.id, name: x.name ?? "", email: x.email ?? "", at: x.created_at, context: x.beats?.title ? `Exclusive inquiry · ${x.beats.title}` : "Exclusive inquiry" })),
      ...(b.data ?? []).map((x: any) => ({ source: "access_applications" as const, id: x.id, name: x.name ?? "", email: x.email ?? "", at: x.created_at, context: x.beat_title ? `Application · ${x.beat_title}` : "Application" })),
    ]
      .filter((x) => x.email)
      .sort((x, y) => (x.at < y.at ? 1 : -1))
      .map((x) => ({ ...x, lastReply: last.get(`${x.source}:${x.id}`) ?? null }));
    return { inquiries: rows };
  });

export const adminSendInquiryReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      source: z.enum(SOURCES),
      sourceId: z.string().uuid(),
      confirmEmail: z.string().trim().toLowerCase().email(),
      subject: z.string().trim().min(1).max(200),
      body: z.string().trim().min(1).max(10000),
      confirmed: z.literal(true),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = (context as any).supabase;
    const { data: inq } = await sb.from(data.source).select("id, name, email, created_at").eq("id", data.sourceId).maybeSingle();
    if (!inq?.email) return { ok: false as const, reason: "Inquiry not found." };
    const to = String(inq.email).trim().toLowerCase();
    if (to !== data.confirmEmail) return { ok: false as const, reason: "Recipient doesn't match the inquiry's email." };

    const { data: row, error } = await sb.from("inquiry_replies").insert({
      source_table: data.source, source_id: data.sourceId, to_email: to, subject: data.subject, body: data.body, sent_by: context.userId,
    }).select("id").single();
    if (error) return { ok: false as const, reason: "Couldn't record the reply." };

    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    let status: "sent" | "suppressed" | "failed" = "failed";
    let err: string | null = null;
    try {
      const res = await sendTemplateEmail("inquiry-reply", to, {
        templateData: {
          name: inq.name ?? "",
          subject: data.subject,
          body: data.body,
          originalDate: new Date(inq.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        },
        idempotencyKey: `inquiry-reply-${row.id}`,
        replyTo: (context as any).claims?.email || undefined,
      });
      status = res.sent ? "sent" : "suppressed";
    } catch (e: any) {
      console.error("inquiry reply send failed", e);
      err = String(e?.code || e?.message || "send_failed").slice(0, 200);
    }
    await sb.from("inquiry_replies").update({ status, error: err, updated_at: new Date().toISOString() }).eq("id", row.id);
    return { ok: status === "sent", status, reason: status === "suppressed" ? "This person has unsubscribed or bounced, so it wasn't sent." : err ? "Sending failed. It was recorded; you can try again." : null };
  });
