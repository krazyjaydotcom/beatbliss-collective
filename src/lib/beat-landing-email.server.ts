// Server-only helpers for sending beat-landing related emails.
// Sends through Lovable's managed email API.
import { EmailAPIError, sendLovableEmail } from "@lovable.dev/email-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const FROM = "MYBEATCATALOG <noreply@notify.krazyjay.com>";
const SENDER_DOMAIN = "notify.krazyjay.com";
const FALLBACK_ADMIN_EMAIL = "krazyjaydotcom@gmail.com";
const SITE = "https://mybeatcatalog.com";

type EmailPayload = Record<string, unknown> & {
  message_id: string;
  to: string;
  subject?: string;
  html?: string;
  text?: string;
  reply_to?: string;
  label?: string;
};

function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

// Idempotency: skip if a message with this message_id has already been logged (any status incl. sent).
async function alreadyQueued(messageId: string): Promise<boolean> {
  try {
    const { data } = await (supabaseAdmin as any)
      .from("email_send_log")
      .select("id")
      .eq("message_id", messageId)
      .limit(1)
      .maybeSingle();
    return !!data;
  } catch {
    return false;
  }
}

async function logEmailAttempt(
  payload: EmailPayload,
  status: "sent" | "suppressed" | "failed",
  errorMessage?: string
): Promise<void> {
  const { error } = await (supabaseAdmin as any).from("email_send_log").insert({
    message_id: payload.message_id,
    template_name: payload.label || "beat_landing_email",
    recipient_email: payload.to,
    status,
    error_message: errorMessage ?? null,
  });
  if (error) console.error("[beat-landing-email] log failed", error);
}

async function enqueue(payload: EmailPayload): Promise<{ messageId: string }> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

  try {
    await sendLovableEmail(
      {
        to: payload.to,
        from: FROM,
        sender_domain: SENDER_DOMAIN,
        subject: String(payload.subject ?? ""),
        html: String(payload.html ?? ""),
        text: String(payload.text ?? ""),
        reply_to: payload.reply_to ? String(payload.reply_to) : undefined,
        purpose: "transactional",
        label: payload.label || "beat_landing_email",
        idempotency_key: payload.message_id,
      },
      { apiKey, sendUrl: process.env["LOVABLE_SEND_URL"] }
    );
    await logEmailAttempt(payload, "sent");
    return { messageId: payload.message_id };
  } catch (err) {
    if (err instanceof EmailAPIError && err.code === "recipient_suppressed") {
      await logEmailAttempt(payload, "suppressed", "Recipient is suppressed");
      return { messageId: payload.message_id };
    }
    console.error("[beat-landing-email] send failed", err);
    await logEmailAttempt(payload, "failed", err instanceof Error ? err.message : "Failed to send email");
    throw err;
  }
}


// --- Free MP3 download email ---
export async function queueFreeDownloadEmail(opts: {
  to: string;
  firstName: string;
  beatTitle: string;
  downloadUrl: string;
  beatSlug?: string | null;
}): Promise<{ messageId: string }> {
  const messageId = `bl_free_${opts.beatSlug || "unknown"}_${opts.to.toLowerCase()}_${Date.now()}`;
  const { resolveTemplate } = await import("@/lib/email-templates.server");
  const resolved = await resolveTemplate("beat_free_download", {
    firstName: opts.firstName || "there",
    beatTitle: opts.beatTitle,
    downloadUrl: opts.downloadUrl,
  });
  const subject = resolved?.subject ?? `Your free MP3: ${opts.beatTitle}`;
  const html = resolved?.html ?? `<!doctype html><html><body><p>Your free MP3 of ${escapeHtml(opts.beatTitle)}: <a href="${escapeHtml(opts.downloadUrl)}">${escapeHtml(opts.downloadUrl)}</a></p></body></html>`;
  const text = `Hey ${opts.firstName || "there"},\n\nYour free MP3 of "${opts.beatTitle}" is ready:\n${opts.downloadUrl}\n\n— MYBEATCATALOG`;
  return enqueue({ to: opts.to, subject, html, text, label: "beat_free_download", message_id: messageId });
}

// --- Paid purchase: buyer email with download + license ---
export async function queueBuyerPurchaseEmail(opts: {
  to: string;
  beatTitle: string;
  downloadUrl: string | null;
  amountCents: number;
  sessionId: string;
  beatSlug: string | null;
}): Promise<{ queued: boolean; skipped?: string; messageId?: string }> {
  const messageId = `bl_buyer_${opts.sessionId}`;
  if (await alreadyQueued(messageId)) return { queued: false, skipped: "already_queued" };

  const price = `$${(opts.amountCents / 100).toFixed(2)}`;
  const date = new Date().toISOString().slice(0, 10);
  const { resolveTemplate } = await import("@/lib/email-templates.server");
  const resolved = await resolveTemplate("beat_purchase_buyer", {
    beatTitle: opts.beatTitle,
    downloadUrl: opts.downloadUrl || `${SITE}`,
    amount: price,
    sessionId: opts.sessionId,
    buyerEmail: opts.to,
    date,
  });
  const subject = resolved?.subject ?? `Your beat is ready — ${opts.beatTitle}`;
  const html = resolved?.html ?? `<!doctype html><html><body><p>Thanks for purchasing ${escapeHtml(opts.beatTitle)} (${price}). ${opts.downloadUrl ? `<a href="${escapeHtml(opts.downloadUrl)}">Download</a>` : ""}</p></body></html>`;
  const text = `Thank you for your purchase!\n\nBeat: ${opts.beatTitle}\nAmount: ${price}\nPurchase ID: ${opts.sessionId}\nDate: ${date}\n\n${opts.downloadUrl ? `Download: ${opts.downloadUrl}\n\n` : ""}— MYBEATCATALOG`;
  await enqueue({ to: opts.to, subject, html, text, label: "beat_purchase_buyer", message_id: messageId });
  return { queued: true, messageId };
}

// --- Paid purchase: admin sales notification ---
export async function queueAdminSaleEmail(opts: {
  beatTitle: string;
  buyerEmail: string;
  amountCents: number;
  sessionId: string;
  beatSlug: string | null;
  overrideRecipient?: string;
}): Promise<{ queued: boolean; skipped?: string; messageId?: string }> {
  const messageId = `bl_admin_${opts.sessionId}`;
  if (await alreadyQueued(messageId)) return { queued: false, skipped: "already_queued" };

  // Resolve admin email
  let adminEmail = opts.overrideRecipient || process.env.SALES_NOTIFICATION_EMAIL || null;
  if (!adminEmail) {
    try {
      const { data } = await (supabaseAdmin as any).from("global_video").select("contact_email").eq("id", 1).maybeSingle();
      if (data?.contact_email) adminEmail = data.contact_email as string;
    } catch { /* ignore */ }
  }
  if (!adminEmail) adminEmail = FALLBACK_ADMIN_EMAIL;

  const price = `$${(opts.amountCents / 100).toFixed(2)}`;
  const beatUrl = opts.beatSlug ? `${SITE}/beats/${opts.beatSlug}` : SITE;
  const { resolveTemplate } = await import("@/lib/email-templates.server");
  const resolved = await resolveTemplate("beat_purchase_admin", {
    beatTitle: opts.beatTitle,
    buyerEmail: opts.buyerEmail,
    amount: price,
    sessionId: opts.sessionId,
    beatUrl,
  });
  const subject = resolved?.subject ?? `[Sale] ${opts.beatTitle} — ${price}`;
  const html = resolved?.html ?? `<!doctype html><html><body><p>New sale: ${escapeHtml(opts.beatTitle)} ${price}</p></body></html>`;
  const text = `New beat lease sale — ${price}\nBeat: ${opts.beatTitle}\nBuyer: ${opts.buyerEmail}\nAmount: ${price}\nStripe session: ${opts.sessionId}\nBeat URL: ${beatUrl}`;

  await enqueue({ to: adminEmail, subject, html, text, label: "beat_purchase_admin", message_id: messageId });
  return { queued: true, messageId };
}

// --- Exclusive/custom inquiry from beat landing page ---
export async function queueExclusiveInquiryEmail(opts: {
  submissionId: string;
  name: string;
  email: string;
  beatTitle: string | null;
  beatSlug: string | null;
  answers: Record<string, string>;
  labels: Record<string, string>;
  overrideRecipient?: string;
}): Promise<{ queued: boolean; messageId?: string }> {
  const messageId = `bl_inquiry_${opts.submissionId}`;
  if (await alreadyQueued(messageId)) return { queued: false };

  const recipient = opts.overrideRecipient || process.env.SALES_NOTIFICATION_EMAIL || "jason@krazyjay.com";
  const beatTitleLabel = opts.beatTitle || "(no specific beat)";
  const beatUrl = opts.beatSlug ? `${SITE}/beats/${opts.beatSlug}` : SITE;

  const rowsHtml = Object.entries(opts.answers).map(([qid, val]) => {
    const label = escapeHtml(opts.labels[qid] || qid);
    const safeVal = escapeHtml(val || "—").replace(/\n/g, "<br>");
    return `<tr><td style="padding:6px 12px 6px 0;color:#71717a;vertical-align:top;white-space:nowrap"><strong>${label}</strong></td><td style="padding:6px 0;color:#111">${safeVal}</td></tr>`;
  }).join("");

  const { resolveTemplate } = await import("@/lib/email-templates.server");
  const resolved = await resolveTemplate("beat_exclusive_inquiry", {
    name: opts.name,
    email: opts.email,
    beatTitle: beatTitleLabel,
    beatUrl,
    answersTable: rowsHtml,
  });
  const subject = resolved?.subject ?? `[Inquiry] ${opts.name} — ${opts.beatTitle || "custom work"}`;
  const html = resolved?.html ?? `<!doctype html><html><body><p>Inquiry from ${escapeHtml(opts.name)} (${escapeHtml(opts.email)}) about ${escapeHtml(beatTitleLabel)}</p></body></html>`;
  const textLines = [
    `New exclusive/custom inquiry`,
    `Name: ${opts.name}`,
    `Email: ${opts.email}`,
    `Beat: ${beatUrl}`,
    ...Object.entries(opts.answers).map(([qid, val]) => `${opts.labels[qid] || qid}: ${val}`),
  ];
  await enqueue({
    to: recipient,
    subject,
    html, text: textLines.join("\n"),
    label: "beat_exclusive_inquiry", message_id: messageId,
    reply_to: opts.email,
  });
  return { queued: true, messageId };
}
