import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TYPES: Record<string, string> = {
  pdf: "application/pdf",
  txt: "text/plain",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};
const attachment = z.object({
  path: z.string().regex(/^uploads\/[\w.\- ]+$/),
  name: z.string().min(1).max(200),
});
const email = z.string().trim().toLowerCase().email().max(254);
async function admin(context: any) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error || !data) throw new Error("Forbidden");
}
function config() {
  const key = process.env.BIRD_API_KEY,
    from = process.env.BIRD_FROM_EMAIL;
  const region = process.env.BIRD_REGION;
  const missing = [
    !key && "BIRD_API_KEY",
    !from && "BIRD_FROM_EMAIL",
    !region && "BIRD_REGION",
  ].filter(Boolean) as string[];
  return {
    key,
    from,
    region,
    missing,
    valid:
      missing.length === 0 &&
      email.safeParse(from).success &&
      (region === "us1" || region === "eu1"),
  };
}
async function bird(path: string, init: RequestInit = {}) {
  const c = config();
  if (!c.valid) throw new Error("Configure Bird in Email settings first.");
  return fetch(`https://${c.region}.platform.bird.com/v1/email${path}`, {
    ...init,
    signal: AbortSignal.timeout(30_000),
    headers: {
      Authorization: `Bearer ${c.key}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
}
export const adminBirdStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await admin(context);
    const c = config();
    return {
      configured: c.valid,
      from: c.from ?? null,
      region: c.region ?? null,
      missing: c.missing,
      reason: c.valid
        ? "Settings saved. Bird checks the sending domain and account allowance when you send."
        : "Bird needs server settings and a verified sending domain. Drafts are available now.",
    };
  });

/** Fail closed on lookup failures and opt-outs. Being a customer is not marketing consent. */
async function checkRecipients(sb: any, recipients: string[]) {
  const checks = await Promise.all(
    recipients.map(async (recipient) => {
      const pattern = recipient.replace(/[\\%_]/g, (value) => `\\${value}`);
      const [suppressed, orders, leads, prospects, profiles] = await Promise.all([
        sb.from("suppressed_emails").select("email").ilike("email", pattern).limit(1),
        sb
          .from("lease_orders")
          .select("id")
          .ilike("email", pattern)
          .not("stripe_session_id", "is", null)
          .limit(1),
        sb.from("beat_lead_captures").select("id").ilike("email", pattern).limit(1),
        sb
          .from("crm_prospects")
          .select("id")
          .ilike("email", pattern)
          .neq("stage", "archived")
          .limit(1),
        sb.from("profiles").select("id").ilike("email", pattern).limit(1),
      ]);
      if ([suppressed, orders, leads, prospects, profiles].some((r) => r.error))
        throw new Error("Could not verify recipients; nothing was sent.");
      if (suppressed.data?.length) return { email: recipient, problem: "Unsubscribed or bounced" };
      if (![orders, leads, prospects, profiles].some((r) => r.data?.length))
        return { email: recipient, problem: "Not in customer records" };
      return { email: recipient, problem: null };
    }),
  );
  return checks;
}
export const adminBirdReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ recipients: z.array(email).min(1).max(100) }).parse(d))
  .handler(async ({ data, context }) => {
    await admin(context);
    const { supabaseAdmin: sb } = await import("@/integrations/supabase/client.server");
    return checkRecipients(sb, [...new Set(data.recipients)]);
  });

export const adminBirdSend = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        requestId: z.string().uuid(),
        recipients: z.array(email).min(1).max(100),
        subject: z.string().trim().min(1).max(200),
        body: z.string().trim().min(1).max(20000),
        category: z.enum(["transactional", "marketing"]),
        consentConfirmed: z.boolean(),
        confirmed: z.literal(true),
        files: z.array(attachment).max(5),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await admin(context);
    const c = config();
    if (!c.valid)
      return { ok: false as const, reason: "Bird is not configured. Save this as a draft." };
    const recipients = [...new Set(data.recipients)];
    if (recipients.length > 1 && data.category !== "marketing")
      return { ok: false as const, reason: "Bulk messages must use marketing protections." };
    if (data.category === "marketing" && !data.consentConfirmed)
      return {
        ok: false as const,
        reason: "Confirm permission to send marketing to every selected recipient.",
      };
    const { supabaseAdmin: sb } = await import("@/integrations/supabase/client.server");
    const checks = await checkRecipients(sb, recipients);
    const blocked = checks.filter((r) => r.problem);
    if (blocked.length)
      return {
        ok: false as const,
        reason: `${blocked.length} recipient(s) need attention. Return to review.`,
      };
    const attachments: { filename: string; content: string; content_type: string }[] = [];
    let rawTotal = 0;
    for (const file of data.files) {
      const name = file.name
        .split(/[\\/]/)
        .pop()!
        .replace(/[^\w.\- ]/g, "_");
      const type = TYPES[name.split(".").pop()!.toLowerCase()];
      if (!type) return { ok: false as const, reason: `${name}: unsupported attachment type.` };
      const { data: blob, error } = await context.supabase.storage
        .from("email-attachments")
        .download(file.path);
      if (error || !blob || !blob.size || blob.size > 10 * 1024 * 1024)
        return { ok: false as const, reason: `${name}: missing, empty or larger than 10 MB.` };
      rawTotal += blob.size;
      if (rawTotal > 10 * 1024 * 1024)
        return { ok: false as const, reason: "Use download links for files over 10 MB total." };
      attachments.push({
        filename: name,
        content: Buffer.from(await blob.arrayBuffer()).toString("base64"),
        content_type: type,
      });
    }
    const messages = recipients.map((recipient) => ({
      from: { email: c.from, name: "MYBEATCATALOG" },
      to: [recipient],
      subject: data.subject,
      text: data.body,
      category: data.category,
      attachments,
      metadata: { request_id: data.requestId, source: "admin" },
      track_opens: false,
      track_clicks: false,
    }));
    // Reject oversized attachment batches before expanding repeated base64 strings.
    const estimatedBytes = (new TextEncoder().encode(JSON.stringify(messages[0])).length + 254) * messages.length + 32;
    if (estimatedBytes > 19 * 1024 * 1024) return { ok: false as const, reason: "This batch exceeds the encoded request limit. Use a file link or fewer recipients." };
    const payload = JSON.stringify(recipients.length === 1 ? messages[0] : { messages });
    if (new TextEncoder().encode(payload).length > 19 * 1024 * 1024)
      return {
        ok: false as const,
        reason:
          "This batch exceeds the encoded request limit. Use a file link or fewer recipients.",
      };
    // The unique attempt ID prevents double-clicks and retries from sending twice, even after Bird's replay window expires.
    const { error: logError } = await sb
      .from("email_send_log")
      .insert({
        id: data.requestId,
        recipient_email:
          recipients.length === 1 ? recipients[0] : `Bulk: ${recipients.length} recipients`,
        template_name: "bird-admin",
        status: "pending",
        metadata: {
          subject: data.subject,
          recipients,
          sent_by: context.userId,
          category: data.category,
          consent_confirmed: data.consentConfirmed,
          files: data.files.map((f) => f.name),
        },
      });
    if (logError)
      return {
        ok: false as const,
        reason:
          logError.code === "23505"
            ? "This attempt is already recorded. Check History before starting another send."
            : "Could not record this attempt; nothing was sent.",
      };
    let result: any;
    try {
      const response = await bird(recipients.length === 1 ? "/messages" : "/batches", {
        method: "POST",
        headers: { "Idempotency-Key": data.requestId },
        body: payload,
      });
      if (!response.ok) {
        await sb
          .from("email_send_log")
          .update({
            status: "failed",
            error_message: `Bird rejected the request (${response.status}). Check the sender, key, consent and allowance in Bird.`,
          })
          .eq("id", data.requestId);
        return {
          ok: false as const,
          reason: `Bird rejected the send (${response.status}). See History.`,
        };
      }
      result = await response.json();
    } catch {
      await sb
        .from("email_send_log")
        .update({
          status: "unknown",
          error_message:
            "Could not confirm the provider response. Check Bird before sending again.",
        })
        .eq("id", data.requestId);
      return {
        ok: false as const,
        reason: "Send outcome is unknown. Check Bird and History before retrying.",
      };
    }
    const items = recipients.length === 1 ? [result] : result.data;
    if (!Array.isArray(items) || items.length !== recipients.length || items.some((r) => !r.id)) {
      await sb
        .from("email_send_log")
        .update({
          status: "unknown",
          error_message:
            "Provider response could not be reconciled. Check Bird before sending again.",
        })
        .eq("id", data.requestId);
      return {
        ok: false as const,
        reason: "Check Bird before sending again; its response could not be reconciled.",
      };
    }
    const { error } = await sb
      .from("email_send_log")
      .update({
        status: "accepted",
        message_id: items[0].id,
        metadata: {
          subject: data.subject,
          recipients,
          sent_by: context.userId,
          category: data.category,
          consent_confirmed: data.consentConfirmed,
          files: data.files.map((f) => f.name),
          messages: items.map((r) => ({ id: r.id, status: r.status })),
        },
      })
      .eq("id", data.requestId);
    return {
      ok: true as const,
      count: items.length,
      warning: error
        ? "Bird accepted the request, but the log update failed. Check Bird before resending."
        : null,
    };
  });

export const adminBirdHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await admin(context);
    const { supabaseAdmin: sb } = await import("@/integrations/supabase/client.server");
    const { data, error } = await sb
      .from("email_send_log")
      .select("id,recipient_email,status,metadata,error_message,created_at")
      .eq("template_name", "bird-admin")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error("Could not load email history.");
    return data ?? [];
  });

export const adminCustomerEmailHistory = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ email }).parse(d))
  .handler(async ({ data: input, context }) => {
    await admin(context);
    const { supabaseAdmin: sb } = await import("@/integrations/supabase/client.server");
    const { data, error } = await sb.from("email_send_log").select("id,recipient_email,template_name,status,metadata,created_at").order("created_at", { ascending: false }).limit(100);
    if (error) throw new Error("Could not load customer email history.");
    return (data ?? []).filter((r) => r.recipient_email.toLowerCase() === input.email || (Array.isArray((r.metadata as any)?.recipients) && (r.metadata as any).recipients.includes(input.email))).slice(0, 10);
  });
