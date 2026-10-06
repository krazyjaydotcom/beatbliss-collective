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
export type PurchaseTier = "nonexclusive" | "unlimited" | "trackout";

export const TIER_EMAIL: Record<PurchaseTier, { label: string; rights: string; files: string }> = {
  nonexclusive: {
    label: "Non-Exclusive MP3 License",
    rights:
      "Non-exclusive rights to record one song with this beat, sell physical units, and perform the song at events for promotional purposes. Streaming rights are NOT included.",
    files: "Untagged MP3",
  },
  unlimited: {
    label: "Unlimited License (WAV + MP3)",
    rights:
      "Unlimited, worldwide, non-exclusive rights to record, release, distribute, perform, stream, and monetize music created with this beat. Licensee retains 100% of master recording royalties.",
    files: "Untagged WAV + MP3",
  },
  trackout: {
    label: "Unlimited License w/ STEMs",
    rights:
      "Unlimited, worldwide, non-exclusive rights to record, release, distribute, perform, stream, and monetize music created with this beat, including use of the individual track stems. Licensee retains 100% of master recording royalties.",
    files: "Untagged WAV + MP3 now; individual WAV STEMs delivered within 24 hours",
  },
};

export function agreementCode(sessionId: string): string {
  let h = 0;
  for (let i = 0; i < sessionId.length; i++) h = (h * 31 + sessionId.charCodeAt(i)) >>> 0;
  return `MBC-${new Date().getUTCFullYear()}-${h.toString(36).toUpperCase().padStart(7, "0").slice(-7)}`;
}

export async function queueBuyerPurchaseEmail(opts: {
  to: string;
  beatTitle: string;
  downloadUrl: string | null;
  amountCents: number;
  sessionId: string;
  beatSlug: string | null;
  licenseTier?: PurchaseTier;
  wavUrl?: string | null;
  stemsUrl?: string | null;
  agreementCode?: string;
  downloadPageUrl?: string | null;
}): Promise<{ queued: boolean; skipped?: string; messageId?: string }> {
  const messageId = `bl_buyer_${opts.sessionId}`;
  if (await alreadyQueued(messageId)) return { queued: false, skipped: "already_queued" };

  const price = `$${(opts.amountCents / 100).toFixed(2)}`;
  const date = new Date().toISOString().slice(0, 10);

  if (opts.licenseTier && TIER_EMAIL[opts.licenseTier]) {
    const t = TIER_EMAIL[opts.licenseTier];
    const code = opts.agreementCode ?? agreementCode(opts.sessionId);
    const hasStems = opts.licenseTier === "trackout" && !!opts.stemsUrl;
    const links: { label: string; url: string }[] = [];
    if (opts.licenseTier !== "nonexclusive" && opts.wavUrl) links.push({ label: "Download WAV", url: opts.wavUrl });
    if (opts.downloadUrl) links.push({ label: "Download MP3", url: opts.downloadUrl });
    if (hasStems) links.push({ label: "Download STEMs", url: opts.stemsUrl! });
    const e = escapeHtml;
    const buttons = links
      .map((l) => `<a href="${e(l.url)}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:10px;margin:0 8px 8px 0">${e(l.label)}</a>`)
      .join("");
    const pageButton = opts.downloadPageUrl
      ? `<a href="${e(opts.downloadPageUrl)}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:10px;margin:0 8px 8px 0">Your download page (files + license)</a>`
      : "";
    const stemNote = opts.licenseTier === "trackout" && !hasStems
      ? `<p style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:12px;font-size:13px;color:#1e3a8a;margin:0 0 16px">Your STEMs are being prepared and will be emailed within 24 hours.</p>`
      : "";
    const subject = `Your ${t.label} — ${opts.beatTitle}`;
    const html = `<!doctype html><html><body style="margin:0;background:#f6f6f7;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#111"><div style="max-width:600px;margin:0 auto;padding:32px 24px;background:#fff"><h1 style="font-size:24px;font-weight:900;margin:0 0 6px">MYBEATCATALOG</h1><p style="color:#71717a;margin:0 0 24px">Purchase Confirmation</p><h2 style="font-size:20px;margin:0 0 10px">Thank you for your purchase!</h2><p style="line-height:1.6;color:#3f3f46;margin:0 0 16px">You purchased the <strong>${e(t.label)}</strong> for <strong>${e(opts.beatTitle)}</strong> (${price}).<br>Included files: ${e(hasStems ? "Untagged WAV + MP3 + individual WAV STEMs" : t.files)}.</p><div style="margin:0 0 16px">${buttons}</div>${stemNote}<h3 style="font-size:16px;font-weight:800;margin:24px 0 8px">${e(t.label)} Agreement</h3><div style="background:#fafafa;border:1px solid #e4e4e7;border-radius:10px;padding:16px;font-size:13px;line-height:1.6;color:#3f3f46"><p style="margin:0 0 8px"><strong>Agreement ID:</strong> ${code}<br><strong>Licensee:</strong> ${e(opts.to)}<br><strong>Beat:</strong> ${e(opts.beatTitle)}<br><strong>License:</strong> ${e(t.label)}<br><strong>Amount paid:</strong> ${price}<br><strong>Purchase ID:</strong> ${e(opts.sessionId)}<br><strong>Date:</strong> ${date}</p><p style="margin:8px 0"><strong>Rights granted:</strong> ${e(t.rights)}</p><p style="margin:8px 0"><strong>Producer credits (required):</strong> Writer — Jason A. Spencer (IPI 516703075) 50%; Publishing — March 26th Publishing (IPI 1213085595) 50%; PRO — ASCAP. Failure to register these splits voids the rights granted.</p><p style="margin:8px 0 0"><strong>Restrictions:</strong> Licensee may not resell, redistribute, sublicense, or claim sole ownership of the underlying beat. MYBEATCATALOG retains ownership of the composition and production.</p></div><p style="color:#71717a;font-size:12px;margin:16px 0 0">Keep this email as your license record. You can request a copy anytime at ${SITE}/licenses. Questions? Reply to this email.<br>— KRAZYJAYDOTCOM</p></div></body></html>`;
    const text = `Thank you for your purchase!\n\n${t.label} — ${opts.beatTitle} (${price})\nIncluded files: ${hasStems ? "Untagged WAV + MP3 + STEMs" : t.files}\n\n${links.map((l) => `${l.label}: ${l.url}`).join("\n")}\n\n${opts.licenseTier === "trackout" && !hasStems ? "STEMs will be emailed within 24 hours.\n\n" : ""}LICENSE AGREEMENT ${code}\nLicensee: ${opts.to}\nRights: ${t.rights}\nProducer credits: Jason A. Spencer (IPI 516703075) 50% writer; March 26th Publishing (IPI 1213085595) 50% publisher; ASCAP.\nPurchase ID: ${opts.sessionId}\nDate: ${date}\n\n— MYBEATCATALOG`;
    await enqueue({ to: opts.to, subject, html, text, label: "beat_purchase_buyer", message_id: messageId });
    return { queued: true, messageId };
  }

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
  licenseLabel?: string;
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
  const licenseLabel = opts.licenseLabel || "Beat license";
  const { resolveTemplate } = await import("@/lib/email-templates.server");
  const resolved = await resolveTemplate("beat_purchase_admin", {
    beatTitle: opts.beatTitle,
    licenseLabel,
    buyerEmail: opts.buyerEmail,
    amount: price,
    sessionId: opts.sessionId,
    beatUrl,
    salesUrl: `${SITE}/admin/sales`,
    customersUrl: `${SITE}/admin/customers?q=${encodeURIComponent(opts.buyerEmail)}`,
  });
  const subject = resolved?.subject ?? `🔥 BAG ALERT: You just made ${price} on MYBEATCATALOG!`;
  const html = resolved?.html ?? `<!doctype html><html><body><p>New sale: ${escapeHtml(opts.beatTitle)} ${price}</p></body></html>`;
  const text = `🔥 BAG ALERT — ${price}\nSomebody just copped ${opts.beatTitle} (${licenseLabel}).\nBuyer: ${opts.buyerEmail}\nBeat: ${beatUrl}\nView sales: ${SITE}/admin/sales\n\nSession: ${opts.sessionId}`;

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

// --- Licence lookup: buyer requested copies of their licences ---
export async function queueLicenseLookupEmail(opts: {
  to: string;
  licenses: { agreement_code: string; beat_title: string; license_label: string; rights_text: string; amount_cents: number; created_at: string; buyer_name: string | null }[];
}): Promise<void> {
  const e = escapeHtml;
  const credits = "Writer — Jason A. Spencer (IPI 516703075) 50%; Publishing — March 26th Publishing (IPI 1213085595) 50%; PRO — ASCAP.";
  const blocks = opts.licenses.map((l) => `<div style="background:#fafafa;border:1px solid #e4e4e7;border-radius:10px;padding:16px;font-size:13px;line-height:1.6;color:#3f3f46;margin:0 0 14px"><p style="margin:0 0 8px"><strong>${e(l.license_label)} — ${e(l.beat_title)}</strong><br><strong>Agreement ID:</strong> ${e(l.agreement_code)}<br><strong>Licensee:</strong> ${e(l.buyer_name || opts.to)} (${e(opts.to)})<br><strong>Amount paid:</strong> $${(l.amount_cents / 100).toFixed(2)}<br><strong>Date:</strong> ${l.created_at.slice(0, 10)}</p><p style="margin:8px 0"><strong>Rights granted:</strong> ${e(l.rights_text)}</p><p style="margin:8px 0 0"><strong>Producer credits (required):</strong> ${credits}</p></div>`).join("");
  const html = `<!doctype html><html><body style="margin:0;background:#f6f6f7;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#111"><div style="max-width:600px;margin:0 auto;padding:32px 24px;background:#fff"><h1 style="font-size:24px;font-weight:900;margin:0 0 6px">MYBEATCATALOG</h1><p style="color:#71717a;margin:0 0 20px">Your license agreements (${opts.licenses.length})</p>${blocks}<p style="color:#71717a;font-size:12px;margin:16px 0 0">You requested these at mybeatcatalog.com/licenses. Questions? Reply to this email.</p></div></body></html>`;
  const text = opts.licenses.map((l) => `${l.license_label} — ${l.beat_title}\nAgreement ID: ${l.agreement_code}\nDate: ${l.created_at.slice(0, 10)}\nRights: ${l.rights_text}\nCredits: ${credits}`).join("\n\n");
  const bucket = Math.floor(Date.now() / (10 * 60 * 1000));
  if (await alreadyQueued(`license_lookup_${opts.to}_${bucket}`)) return;
  await enqueue({ to: opts.to, subject: "Your MYBEATCATALOG license agreements", html, text, label: "license_lookup", message_id: `license_lookup_${opts.to}_${bucket}` });
}
