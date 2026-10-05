// Server-only helpers to resolve editable email templates from Supabase,
// falling back to hardcoded defaults when a template row is missing or disabled.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type TemplateKey =
  | "beat_free_download"
  | "beat_purchase_buyer"
  | "beat_purchase_admin"
  | "beat_exclusive_inquiry"
  | "invite_access"
  | "membership_welcome";

export type TemplateDefault = {
  key: TemplateKey;
  name: string;
  subject: string;
  preview_text: string | null;
  html: string;
  variables: string[];
};

const SITE = "https://mybeatcatalog.com";

// Base default templates. These are seeded on first admin list and are used as
// fallback whenever a row is missing/disabled/invalid.
export const DEFAULT_EMAIL_TEMPLATES: TemplateDefault[] = [
  {
    key: "beat_free_download",
    name: "Free MP3 delivery",
    subject: "Your free MP3: {{beatTitle}}",
    preview_text: "Your free tagged MP3 is ready to download.",
    variables: ["firstName", "beatTitle", "downloadUrl", "siteName", "supportEmail"],
    html: `<!doctype html><html><body style="margin:0;background:#f6f6f7;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#111"><div style="max-width:560px;margin:0 auto;padding:32px 24px;background:#fff"><h1 style="font-size:24px;font-weight:900;margin:0 0 6px">{{siteName}}</h1><p style="color:#71717a;margin:0 0 24px">Free MP3 Download</p><h2 style="font-size:20px;margin:0 0 10px">Hey {{firstName}},</h2><p style="line-height:1.6;color:#3f3f46;margin:0 0 20px">Here's your free MP3 of <strong>{{beatTitle}}</strong>. Tap the button below to download.</p><p style="margin:0 0 24px"><a href="{{downloadUrl}}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-weight:700;padding:14px 24px;border-radius:10px">Download MP3</a></p><p style="color:#71717a;font-size:12px;line-height:1.6;margin:0">Or paste this link into your browser:<br><a href="{{downloadUrl}}" style="color:#2563eb;word-break:break-all">{{downloadUrl}}</a></p><hr style="border:none;border-top:1px solid #e4e4e7;margin:28px 0"/><p style="color:#71717a;font-size:12px;margin:0">Preview / free tier download. For unlimited monetization rights, purchase the Unlimited License at <a href="${SITE}" style="color:#2563eb">mybeatcatalog.com</a>. Questions? {{supportEmail}}</p></div></body></html>`,
  },
  {
    key: "beat_purchase_buyer",
    name: "Purchase confirmation (buyer)",
    subject: "Your beat is ready — {{beatTitle}}",
    preview_text: "Your Unlimited License and download link.",
    variables: ["beatTitle", "downloadUrl", "amount", "sessionId", "buyerEmail", "date", "siteName"],
    html: `<!doctype html><html><body style="margin:0;background:#f6f6f7;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#111"><div style="max-width:600px;margin:0 auto;padding:32px 24px;background:#fff"><h1 style="font-size:24px;font-weight:900;margin:0 0 6px">{{siteName}}</h1><p style="color:#71717a;margin:0 0 24px">Purchase Confirmation</p><h2 style="font-size:20px;margin:0 0 10px">Thank you for your purchase!</h2><p style="line-height:1.6;color:#3f3f46;margin:0 0 16px">You've successfully purchased a lease for <strong>{{beatTitle}}</strong> ({{amount}}).</p><p style="margin:0 0 24px"><a href="{{downloadUrl}}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-weight:700;padding:14px 24px;border-radius:10px">Download Your Beat (MP3)</a></p><h3 style="font-size:16px;font-weight:800;margin:24px 0 8px">Unlimited License Agreement</h3><div style="background:#fafafa;border:1px solid #e4e4e7;border-radius:10px;padding:16px;font-size:13px;line-height:1.6;color:#3f3f46"><p style="margin:0 0 8px"><strong>Licensee:</strong> {{buyerEmail}}<br><strong>Beat:</strong> {{beatTitle}}<br><strong>Amount paid:</strong> {{amount}}<br><strong>Purchase ID:</strong> {{sessionId}}<br><strong>Date:</strong> {{date}}</p><p style="margin:8px 0"><strong>Rights granted:</strong> Unlimited, worldwide, non-exclusive rights to record, release, distribute, perform, stream, and monetize music created with this beat. Licensee retains 100% of master recording royalties.</p><p style="margin:8px 0"><strong>Producer credits (required):</strong> Writer — Jason A. Spencer (IPI 516703075) 50%; Publishing — March 26th Publishing (IPI 1213085595) 50%; PRO — ASCAP.</p><p style="margin:8px 0 0"><strong>Restrictions:</strong> Licensee may not resell, redistribute, sublicense, or claim sole ownership of the underlying beat.</p></div><hr style="border:none;border-top:1px solid #e4e4e7;margin:28px 0"/><p style="color:#71717a;font-size:12px;margin:0">Questions? Reply to this email.<br>— KRAZYJAYDOTCOM</p></div></body></html>`,
  },
  {
    key: "beat_purchase_admin",
    name: "Sale notification (admin)",
    subject: "🔥 BAG ALERT: You just made {{amount}} on MYBEATCATALOG!",
    preview_text: "Somebody just copped {{beatTitle}} — {{licenseLabel}}",
    variables: ["beatTitle", "licenseLabel", "buyerEmail", "amount", "sessionId", "beatUrl", "salesUrl", "customersUrl"],
    html: `<!doctype html><html><body style="margin:0;background:#0b0f19;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#f5f3ee"><div style="max-width:560px;margin:0 auto;padding:32px 20px"><div style="background:linear-gradient(135deg,#1d4ed8,#0b0f19);border-radius:18px;padding:28px 24px;text-align:center"><div style="font-size:13px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:#bfdbfe">🔥 Bag Alert 🔥</div><div style="font-size:48px;font-weight:900;margin:10px 0 4px;color:#ffffff">{{amount}}</div><div style="font-size:15px;color:#dbeafe">Cha-ching! Somebody just copped a beat.</div></div><div style="background:#121826;border:1px solid #1f2937;border-radius:14px;padding:20px 22px;margin-top:16px"><div style="font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:.12em">Beat</div><div style="font-size:20px;font-weight:800;margin:4px 0 14px"><a href="{{beatUrl}}" style="color:#f5f3ee;text-decoration:none">🎵 {{beatTitle}}</a></div><div style="font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:.12em">License</div><div style="font-size:15px;font-weight:700;margin:4px 0 14px;color:#93c5fd">🏷️ {{licenseLabel}}</div><div style="font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:.12em">Buyer</div><div style="font-size:15px;margin:4px 0 0">👤 <a href="mailto:{{buyerEmail}}" style="color:#f5f3ee">{{buyerEmail}}</a></div></div><div style="text-align:center;margin-top:20px"><a href="{{salesUrl}}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-weight:800;padding:12px 20px;border-radius:10px;margin:4px">View sales</a><a href="mailto:{{buyerEmail}}" style="display:inline-block;background:#1f2937;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:10px;margin:4px">Email buyer</a><a href="{{customersUrl}}" style="display:inline-block;background:#1f2937;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:10px;margin:4px">Customer profile</a></div><p style="text-align:center;font-size:14px;color:#cbd5e1;margin:24px 0 0">Keep cooking. 🔥</p><p style="text-align:center;font-family:monospace;font-size:10px;color:#475569;margin:20px 0 0">Session {{sessionId}}</p></div></body></html>`,
  },
  {
    key: "beat_exclusive_inquiry",
    name: "Exclusive / custom inquiry (admin)",
    subject: "[Inquiry] {{name}} — {{beatTitle}}",
    preview_text: null,
    variables: ["name", "email", "beatTitle", "beatUrl", "answersTable"],
    html: `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#111;padding:24px;background:#f6f6f7"><div style="max-width:640px;margin:0 auto;background:#fff;border-radius:12px;padding:24px"><h2 style="margin:0 0 6px;color:#2563eb">New exclusive/custom inquiry</h2><p style="margin:0 0 16px;color:#71717a">Submitted from {{beatTitle}}</p><table style="border-collapse:collapse;font-size:14px;width:100%"><tr><td style="padding:6px 12px 6px 0;color:#71717a"><strong>Name</strong></td><td>{{name}}</td></tr><tr><td style="padding:6px 12px 6px 0;color:#71717a"><strong>Email</strong></td><td><a href="mailto:{{email}}" style="color:#2563eb">{{email}}</a></td></tr><tr><td style="padding:6px 12px 6px 0;color:#71717a"><strong>Beat</strong></td><td><a href="{{beatUrl}}" style="color:#2563eb">{{beatUrl}}</a></td></tr>{{answersTable}}</table></div></body></html>`,
  },
  {
    key: "invite_access",
    name: "Invite / access grant",
    subject: "You're invited to {{siteName}}",
    preview_text: "Claim your access.",
    variables: ["inviteUrl", "siteName", "supportEmail"],
    html: `<!doctype html><html><body style="margin:0;background:#f6f6f7;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#111"><div style="max-width:560px;margin:0 auto;padding:32px 24px;background:#fff"><h1 style="font-size:24px;font-weight:900;margin:0 0 12px">{{siteName}}</h1><p style="line-height:1.6;color:#3f3f46;margin:0 0 20px">You've been invited. Tap the button below to claim your access.</p><p style="margin:0 0 24px"><a href="{{inviteUrl}}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-weight:700;padding:14px 24px;border-radius:10px">Claim access</a></p><p style="color:#71717a;font-size:12px;margin:0">Need help? {{supportEmail}}</p></div></body></html>`,
  },
  {
    key: "membership_welcome",
    name: "Membership welcome",
    subject: "Welcome to {{siteName}}",
    preview_text: "Your membership is active.",
    variables: ["firstName", "loginUrl", "siteName", "supportEmail"],
    html: `<!doctype html><html><body style="margin:0;background:#f6f6f7;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#111"><div style="max-width:560px;margin:0 auto;padding:32px 24px;background:#fff"><h1 style="font-size:24px;font-weight:900;margin:0 0 12px">{{siteName}}</h1><h2 style="font-size:20px;margin:0 0 10px">Welcome, {{firstName}}!</h2><p style="line-height:1.6;color:#3f3f46;margin:0 0 20px">Your membership is active. Jump back in whenever you're ready.</p><p style="margin:0 0 24px"><a href="{{loginUrl}}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-weight:700;padding:14px 24px;border-radius:10px">Open my account</a></p><p style="color:#71717a;font-size:12px;margin:0">Questions? {{supportEmail}}</p></div></body></html>`,
  },
];

export const ALLOWED_MERGE_TAGS = [
  "beatTitle", "artistName", "firstName", "buyerEmail",
  "downloadUrl", "checkoutUrl", "loginUrl", "inviteUrl", "beatUrl",
  "supportEmail", "unsubscribeUrl", "siteName",
  "amount", "sessionId", "date",
  "name", "email", "answersTable",
] as const;

function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

/** Render `{{var}}` substitutions. If `escape` is true, values are HTML-escaped. */
export function applyMergeTags(input: string, vars: Record<string, unknown>, escape = true): string {
  return input.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key: string) => {
    const raw = vars[key];
    if (raw == null) return "";
    // answersTable is intentionally raw HTML.
    if (key === "answersTable" || !escape) return String(raw);
    return escapeHtml(String(raw));
  });
}

type Resolved = { subject: string; html: string; previewText: string | null; source: "db" | "default" };

/** Return the DB template if enabled, otherwise the hardcoded default. */
export async function resolveTemplate(
  key: TemplateKey,
  vars: Record<string, unknown>,
): Promise<Resolved | null> {
  const def = DEFAULT_EMAIL_TEMPLATES.find((t) => t.key === key) || null;
  let row: { subject: string; html: string; preview_text: string | null; enabled: boolean } | null = null;
  try {
    const { data } = await (supabaseAdmin as any)
      .from("email_templates")
      .select("subject,html,preview_text,enabled")
      .eq("template_key", key)
      .maybeSingle();
    row = data ?? null;
  } catch {
    row = null;
  }

  const use = row && row.enabled && row.subject && row.html ? row : def;
  if (!use) return null;
  const source: "db" | "default" = row && row.enabled && row.subject && row.html ? "db" : "default";

  const withDefaults = { siteName: "MYBEATCATALOG", supportEmail: "support@krazyjay.com", ...vars };
  return {
    subject: applyMergeTags(use.subject, withDefaults, false),
    html: applyMergeTags(use.html, withDefaults, true),
    previewText: use.preview_text ? applyMergeTags(use.preview_text, withDefaults, false) : null,
    source,
  };
}
