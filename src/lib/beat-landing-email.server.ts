// Server-only helpers for queueing beat-landing related emails.
// Uses the existing project email queue (transactional_emails) via supabaseAdmin.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const FROM = "MYBEATCATALOG <noreply@notify.krazyjay.com>";
const SENDER_DOMAIN = "notify.krazyjay.com";
const FALLBACK_ADMIN_EMAIL = "krazyjaydotcom@gmail.com";
const SITE = "https://mybeatcatalog.com";

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

async function enqueue(payload: Record<string, unknown> & { message_id: string }): Promise<void> {
  try {
    await (supabaseAdmin as any).rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: {
        from: FROM,
        sender_domain: SENDER_DOMAIN,
        queued_at: new Date().toISOString(),
        purpose: "transactional",
        idempotency_key: payload.message_id,
        ...payload,
      },
    });
  } catch (err) {
    console.error("[beat-landing-email] enqueue failed", err);
  }
}


// --- Free MP3 download email ---
export async function queueFreeDownloadEmail(opts: {
  to: string;
  firstName: string;
  beatTitle: string;
  downloadUrl: string;
  beatSlug?: string | null;
}): Promise<void> {
  const messageId = `bl_free_${opts.beatSlug || "unknown"}_${opts.to.toLowerCase()}_${Date.now()}`;
  const subject = `Your free MP3: ${opts.beatTitle}`;
  const safeName = escapeHtml(opts.firstName || "there");
  const safeTitle = escapeHtml(opts.beatTitle);
  const safeUrl = escapeHtml(opts.downloadUrl);
  const html = `<!doctype html><html><body style="margin:0;background:#f6f6f7;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#111">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px;background:#fff">
    <h1 style="font-size:24px;font-weight:900;margin:0 0 6px">MY<span style="color:#2563eb">BEAT</span>CATALOG</h1>
    <p style="color:#71717a;margin:0 0 24px">Free MP3 Download</p>
    <h2 style="font-size:20px;margin:0 0 10px">Hey ${safeName},</h2>
    <p style="line-height:1.6;color:#3f3f46;margin:0 0 20px">Here's your free MP3 of <strong>${safeTitle}</strong>. Tap the button below to download.</p>
    <p style="margin:0 0 24px"><a href="${safeUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-weight:700;padding:14px 24px;border-radius:10px">Download MP3</a></p>
    <p style="color:#71717a;font-size:12px;line-height:1.6;margin:0">Or paste this link into your browser:<br><a href="${safeUrl}" style="color:#2563eb;word-break:break-all">${safeUrl}</a></p>
    <hr style="border:none;border-top:1px solid #e4e4e7;margin:28px 0" />
    <p style="color:#71717a;font-size:12px;margin:0">This is a preview/free tier download. For unlimited monetization rights, purchase the Unlimited License at <a href="${SITE}" style="color:#2563eb">mybeatcatalog.com</a>.</p>
  </div></body></html>`;
  const text = `Hey ${opts.firstName || "there"},\n\nYour free MP3 of "${opts.beatTitle}" is ready:\n${opts.downloadUrl}\n\n— MYBEATCATALOG`;
  await enqueue({ to: opts.to, subject, html, text, label: "beat_free_download", message_id: messageId });
}

// --- Paid purchase: buyer email with download + license ---
export async function queueBuyerPurchaseEmail(opts: {
  to: string;
  beatTitle: string;
  downloadUrl: string | null;
  amountCents: number;
  sessionId: string;
  beatSlug: string | null;
}): Promise<{ queued: boolean; skipped?: string }> {
  const messageId = `bl_buyer_${opts.sessionId}`;
  if (await alreadyQueued(messageId)) return { queued: false, skipped: "already_queued" };

  const safeTitle = escapeHtml(opts.beatTitle);
  const safeUrl = opts.downloadUrl ? escapeHtml(opts.downloadUrl) : null;
  const price = `$${(opts.amountCents / 100).toFixed(2)}`;
  const date = new Date().toISOString().slice(0, 10);
  const safeEmail = escapeHtml(opts.to);
  const safeSession = escapeHtml(opts.sessionId);

  const licenseHtml = `
    <h3 style="font-size:16px;font-weight:800;margin:24px 0 8px">Unlimited License Agreement</h3>
    <div style="background:#fafafa;border:1px solid #e4e4e7;border-radius:10px;padding:16px;font-size:13px;line-height:1.6;color:#3f3f46">
      <p style="margin:0 0 8px"><strong>Licensee:</strong> ${safeEmail}<br>
      <strong>Beat:</strong> ${safeTitle}<br>
      <strong>Amount paid:</strong> ${price}<br>
      <strong>Purchase ID:</strong> ${safeSession}<br>
      <strong>Date:</strong> ${date}</p>
      <p style="margin:8px 0"><strong>Rights granted:</strong> Unlimited, worldwide, non-exclusive rights to record, release, distribute, perform, stream, and monetize music created with this beat across all platforms (streaming, social, sync, live, physical/digital sales). Licensee retains 100% of master recording royalties.</p>
      <p style="margin:8px 0"><strong>Producer credits (required):</strong> Writer — Jason A. Spencer (IPI 516703075) 50%; Publishing — March 26th Publishing (IPI 1213085595) 50%; PRO — ASCAP.</p>
      <p style="margin:8px 0 0"><strong>Restrictions:</strong> Licensee may not resell, redistribute, sublicense, or claim sole ownership of the underlying beat/composition. Ownership of the beat remains with KRAZYJAYDOTCOM.</p>
    </div>`;

  const html = `<!doctype html><html><body style="margin:0;background:#f6f6f7;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#111">
  <div style="max-width:600px;margin:0 auto;padding:32px 24px;background:#fff">
    <h1 style="font-size:24px;font-weight:900;margin:0 0 6px">MY<span style="color:#2563eb">BEAT</span>CATALOG</h1>
    <p style="color:#71717a;margin:0 0 24px">Purchase Confirmation</p>
    <h2 style="font-size:20px;margin:0 0 10px">Thank you for your purchase!</h2>
    <p style="line-height:1.6;color:#3f3f46;margin:0 0 16px">You've successfully purchased a lease for <strong>${safeTitle}</strong> (${price}).</p>
    ${safeUrl
      ? `<p style="margin:0 0 24px"><a href="${safeUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-weight:700;padding:14px 24px;border-radius:10px">Download Your Beat (MP3)</a></p>
         <p style="color:#71717a;font-size:12px;margin:0 0 8px">Or paste this link into your browser:</p>
         <p style="color:#a1a1aa;font-size:12px;word-break:break-all;margin:0 0 8px"><a href="${safeUrl}" style="color:#2563eb">${safeUrl}</a></p>`
      : `<p style="color:#dc2626;margin:0 0 24px">Your download link will be sent shortly. If you don't receive it within 15 minutes, reply to this email.</p>`}
    ${licenseHtml}
    <hr style="border:none;border-top:1px solid #e4e4e7;margin:28px 0" />
    <p style="color:#71717a;font-size:12px;margin:0">Questions? Reply to this email.<br>— KRAZYJAYDOTCOM</p>
  </div></body></html>`;

  const text = `Thank you for your purchase!\n\nBeat: ${opts.beatTitle}\nAmount: ${price}\nPurchase ID: ${opts.sessionId}\nDate: ${date}\n\n${opts.downloadUrl ? `Download: ${opts.downloadUrl}\n\n` : ""}UNLIMITED LICENSE — full monetization rights granted. Producer credits required (Writer: Jason A. Spencer 50%, Publishing: March 26th Publishing 50%, PRO: ASCAP). No resale of the underlying beat.\n\n— MYBEATCATALOG`;
  await enqueue({ to: opts.to, subject: `Your beat is ready — ${opts.beatTitle}`, html, text, label: "beat_purchase_buyer", message_id: messageId });
  return { queued: true };
}

// --- Paid purchase: admin sales notification ---
export async function queueAdminSaleEmail(opts: {
  beatTitle: string;
  buyerEmail: string;
  amountCents: number;
  sessionId: string;
  beatSlug: string | null;
}): Promise<{ queued: boolean; skipped?: string }> {
  const messageId = `bl_admin_${opts.sessionId}`;
  if (await alreadyQueued(messageId)) return { queued: false, skipped: "already_queued" };

  // Resolve admin email
  let adminEmail = process.env.SALES_NOTIFICATION_EMAIL || null;
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
  return { queued: true };
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
}): Promise<{ queued: boolean }> {
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
  return { queued: true };
}
