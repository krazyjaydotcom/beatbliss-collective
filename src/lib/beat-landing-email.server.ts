// Server-only helpers for queueing beat-landing related emails.
// Uses the existing project email queue (transactional_emails) via supabaseAdmin.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const FROM = "MYBEATCATALOG <noreply@notify.krazyjay.com>";
const SENDER_DOMAIN = "notify.krazyjay.com";
const FALLBACK_ADMIN_EMAIL = "krazyjaydotcom@gmail.com";
const SITE = "https://mybeatcatalog.com";

type EmailPayload = Record<string, unknown> & {
  message_id: string;
  to: string;
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

async function getUnsubscribeToken(email: string): Promise<string> {
  const normalizedEmail = email.toLowerCase().trim();
  const { data: existing, error: readError } = await (supabaseAdmin as any)
    .from("email_unsubscribe_tokens")
    .select("token")
    .eq("email", normalizedEmail)
    .maybeSingle();
  if (readError) throw new Error(`Failed to read unsubscribe token: ${readError.message}`);
  if (existing?.token) return existing.token as string;

  const token = crypto.randomUUID();
  const { data: inserted, error: insertError } = await (supabaseAdmin as any)
    .from("email_unsubscribe_tokens")
    .insert({ email: normalizedEmail, token })
    .select("token")
    .maybeSingle();

  if (!insertError && inserted?.token) return inserted.token as string;

  const { data: raced, error: racedError } = await (supabaseAdmin as any)
    .from("email_unsubscribe_tokens")
    .select("token")
    .eq("email", normalizedEmail)
    .maybeSingle();
  if (racedError || !raced?.token) {
    throw new Error(insertError?.message || racedError?.message || "Failed to create unsubscribe token");
  }
  return raced.token as string;
}

async function logEmailAttempt(payload: EmailPayload, status: "pending" | "failed", errorMessage?: string): Promise<void> {
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
  const unsubscribeToken = await getUnsubscribeToken(payload.to);
  await logEmailAttempt(payload, "pending");
  try {
    const { error } = await (supabaseAdmin as any).rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: {
        from: FROM,
        sender_domain: SENDER_DOMAIN,
        queued_at: new Date().toISOString(),
        purpose: "transactional",
        idempotency_key: payload.message_id,
        unsubscribe_token: unsubscribeToken,
        ...payload,
      },
    });
    if (error) throw error;
    return { messageId: payload.message_id };
  } catch (err) {
    console.error("[beat-landing-email] enqueue failed", err);
    await logEmailAttempt(payload, "failed", err instanceof Error ? err.message : "Failed to enqueue email");
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

  const text = `Thank you for your purchase!\n\nBeat: ${opts.beatTitle}\nAmount: ${price}\nPurchase ID: ${opts.sessionId}\nDate: ${date}\n\n${opts.downloadUrl ? `Download: ${opts.downloadUrl}\n\n` : ""}UNLIMITED LICENSE — full monetization rights granted. Producer credits required (Writer: Jason A. Spencer 50%, Publishing: March 26th Publishing 50%, PRO: ASCAP). No resale of the underlying beat.\n\n— MYBEATCATALOG`;
  await enqueue({ to: opts.to, subject: `Your beat is ready — ${opts.beatTitle}`, html, text, label: "beat_purchase_buyer", message_id: messageId });
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
  const safeTitle = escapeHtml(opts.beatTitle);
  const safeBuyer = escapeHtml(opts.buyerEmail);
  const safeSession = escapeHtml(opts.sessionId);
  const safeBeatUrl = escapeHtml(beatUrl);

  const html = `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#111;padding:24px">
    <h2 style="margin:0 0 12px">💰 New beat lease sale — ${price}</h2>
    <table style="border-collapse:collapse;font-size:14px">
      <tr><td style="padding:4px 12px 4px 0;color:#71717a">Beat</td><td><strong>${safeTitle}</strong></td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#71717a">Buyer</td><td>${safeBuyer}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#71717a">Amount</td><td>${price}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#71717a">Stripe session</td><td style="font-family:monospace;font-size:12px">${safeSession}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#71717a">Beat URL</td><td><a href="${safeBeatUrl}">${safeBeatUrl}</a></td></tr>
    </table>
  </body></html>`;
  const text = `New beat lease sale — ${price}\nBeat: ${opts.beatTitle}\nBuyer: ${opts.buyerEmail}\nAmount: ${price}\nStripe session: ${opts.sessionId}\nBeat URL: ${beatUrl}`;

  await enqueue({ to: adminEmail, subject: `[Sale] ${opts.beatTitle} — ${price}`, html, text, label: "beat_purchase_admin", message_id: messageId });
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
  const safeName = escapeHtml(opts.name);
  const safeEmail = escapeHtml(opts.email);
  const safeTitle = opts.beatTitle ? escapeHtml(opts.beatTitle) : "(no specific beat)";
  const beatUrl = opts.beatSlug ? `${SITE}/beats/${opts.beatSlug}` : SITE;

  const rows = Object.entries(opts.answers).map(([qid, val]) => {
    const label = escapeHtml(opts.labels[qid] || qid);
    const safeVal = escapeHtml(val || "—").replace(/\n/g, "<br>");
    return `<tr><td style="padding:6px 12px 6px 0;color:#71717a;vertical-align:top;white-space:nowrap"><strong>${label}</strong></td><td style="padding:6px 0;color:#111">${safeVal}</td></tr>`;
  }).join("");

  const html = `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#111;padding:24px;background:#f6f6f7">
    <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:12px;padding:24px">
      <h2 style="margin:0 0 6px;color:#2563eb">New exclusive/custom inquiry</h2>
      <p style="margin:0 0 16px;color:#71717a">Submitted from ${safeTitle}</p>
      <table style="border-collapse:collapse;font-size:14px;width:100%">
        <tr><td style="padding:6px 12px 6px 0;color:#71717a"><strong>Name</strong></td><td>${safeName}</td></tr>
        <tr><td style="padding:6px 12px 6px 0;color:#71717a"><strong>Email</strong></td><td><a href="mailto:${safeEmail}" style="color:#2563eb">${safeEmail}</a></td></tr>
        <tr><td style="padding:6px 12px 6px 0;color:#71717a"><strong>Beat</strong></td><td><a href="${beatUrl}" style="color:#2563eb">${beatUrl}</a></td></tr>
        ${rows}
      </table>
    </div>
  </body></html>`;
  const textLines = [
    `New exclusive/custom inquiry`,
    `Name: ${opts.name}`,
    `Email: ${opts.email}`,
    `Beat: ${beatUrl}`,
    ...Object.entries(opts.answers).map(([qid, val]) => `${opts.labels[qid] || qid}: ${val}`),
  ];
  await enqueue({
    to: recipient,
    subject: `[Inquiry] ${opts.name} — ${opts.beatTitle || "custom work"}`,
    html, text: textLines.join("\n"),
    label: "beat_exclusive_inquiry", message_id: messageId,
    reply_to: opts.email,
  });
  return { queued: true, messageId };
}
