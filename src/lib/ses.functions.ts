import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Amazon SES v2 one-person sender (admin-only). Credentials live only in server secrets.
 * SES is called solely from adminSesSend, after explicit on-screen confirmation.
 * Never used for bulk; SendFox remains the bulk path; inquiry replies use their own path.
 */
const BUCKET = "email-attachments";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const SES_LIMITS = { maxFiles: 5, maxFileBytes: 10 * 1024 * 1024, maxTotalBytes: 20 * 1024 * 1024 };
// Server-side type map by extension — the browser's MIME claim is ignored.
const TYPES: Record<string, string> = {
  pdf: "application/pdf", doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp",
  mp3: "audio/mpeg", wav: "audio/wav",
};

async function assertAdmin(context: any) {
  const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!data) throw new Error("Forbidden");
}

function cfg() {
  const c = {
    key: process.env["AWS_SES_ACCESS_KEY_ID"], secret: process.env["AWS_SES_SECRET_ACCESS_KEY"],
    region: process.env["AWS_SES_REGION"], from: process.env["AWS_SES_FROM_EMAIL"],
  };
  const missing = [
    !c.key && "AWS_SES_ACCESS_KEY_ID", !c.secret && "AWS_SES_SECRET_ACCESS_KEY",
    !c.region && "AWS_SES_REGION", !c.from && "AWS_SES_FROM_EMAIL",
  ].filter(Boolean) as string[];
  return { ...c, missing };
}

async function ses(path: string, init: RequestInit = {}) {
  const c = cfg();
  const { AwsClient } = await import("aws4fetch");
  const aws = new AwsClient({ accessKeyId: c.key!, secretAccessKey: c.secret!, region: c.region!, service: "ses" });
  return aws.fetch(`https://email.${c.region}.amazonaws.com${path}`, init);
}

function safeName(n: string) {
  const base = n.split(/[\\/]/).pop() ?? "file";
  return base.replace(/[^\w.\- ]+/g, "_").replace(/^\.+/, "").slice(0, 120) || "file";
}
function typeFor(name: string) {
  return TYPES[(name.split(".").pop() ?? "").toLowerCase()] ?? null;
}

/** Read-only status: which settings are missing, account sending state, sender verification. */
export const adminSesStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const c = cfg();
    if (c.missing.length) return { ready: false as const, missing: c.missing, reason: "Not configured" };
    if (!EMAIL_RE.test(c.from!)) return { ready: false as const, missing: [], reason: "AWS_SES_FROM_EMAIL is not a valid address." };
    try {
      const acc = await ses("/v2/email/account");
      if (!acc.ok) return { ready: false as const, missing: [], reason: `SES account check failed (${acc.status}). Check the key, region and IAM permissions (ses:GetAccount).` };
      const a: any = await acc.json();
      if (a.SendingEnabled === false) return { ready: false as const, missing: [], reason: "Sending is paused on this SES account." };
      const domain = c.from!.split("@")[1];
      let verified = false;
      for (const id of [c.from!, domain]) {
        const r = await ses(`/v2/email/identities/${encodeURIComponent(id)}`);
        if (r.ok) { const j: any = await r.json(); if (j.VerifiedForSendingStatus) { verified = true; break; } }
      }
      if (!verified) return { ready: false as const, missing: [], reason: `Sender ${c.from} is not verified in SES (${c.region}).` };
      return { ready: true as const, from: c.from!, region: c.region!, sandbox: a.ProductionAccessEnabled === false };
    } catch {
      return { ready: false as const, missing: [], reason: "Couldn't reach SES." };
    }
  });

/** Consent/opt-out check for one recipient. Read-only. */
async function basisFor(sb: any, email: string, purpose: "personal" | "promotional") {
  const [sup, lead, member, client, prospect] = await Promise.all([
    sb.from("suppressed_emails").select("email").ilike("email", email).limit(1),
    sb.from("beat_lead_captures").select("id").ilike("email", email).limit(1),
    sb.from("profiles").select("id").ilike("email", email).eq("subscription_status", "active").limit(1),
    sb.from("lease_orders").select("id").ilike("email", email).not("stripe_session_id", "is", null).limit(1),
    sb.from("crm_prospects").select("id").ilike("email", email).limit(1),
  ]);
  if ((sup.data ?? []).length) return { ok: false as const, reason: "This address has unsubscribed or bounced. It can't be emailed." };
  if (purpose === "promotional") {
    if ((lead.data ?? []).length) return { ok: true as const, basis: "Subscribed via free-download signup" };
    if ((member.data ?? []).length) return { ok: true as const, basis: "Active member" };
    return { ok: false as const, reason: "No subscription on record (not a free-download signup or active member). Promotional email isn't allowed." };
  }
  if ((client.data ?? []).length) return { ok: true as const, basis: "Existing customer (paid order)" };
  if ((member.data ?? []).length) return { ok: true as const, basis: "Active member" };
  if ((prospect.data ?? []).length) return { ok: true as const, basis: "CRM contact" };
  if ((lead.data ?? []).length) return { ok: true as const, basis: "Free-download signup" };
  return { ok: false as const, reason: "This address isn't in your customer records." };
}

export const adminSesCheckRecipient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ to: z.string().trim().toLowerCase().email(), purpose: z.enum(["personal", "promotional"]) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    return basisFor((context as any).supabase, data.to, data.purpose);
  });

const attSchema = z.object({ path: z.string().regex(/^uploads\/[\w.\- ]+$/), name: z.string().min(1).max(200) });

/** Validate attached files server-side by their actual stored bytes. */
export const adminSesValidateFiles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ files: z.array(attSchema).max(SES_LIMITS.maxFiles) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = (context as any).supabase;
    let total = 0;
    const out: { path: string; name: string; size: number; type: string | null; problem: string | null }[] = [];
    for (const f of data.files) {
      const name = safeName(f.name);
      const type = typeFor(name);
      const { data: blob } = await sb.storage.from(BUCKET).download(f.path);
      const size = blob ? blob.size : 0;
      total += size;
      out.push({ path: f.path, name, size, type,
        problem: !blob ? "File missing or expired — remove and re-add it." : !type ? "File type not allowed." : size > SES_LIMITS.maxFileBytes ? "Over 10 MB." : null });
    }
    return { files: out, total, overTotal: total > SES_LIMITS.maxTotalBytes };
  });

/** The only SES call that sends. One recipient, explicit confirmation, logged. */
export const adminSesSend = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      to: z.string().trim().toLowerCase().email().max(254),
      confirmTo: z.string().trim().toLowerCase().email(),
      subject: z.string().trim().min(1).max(200),
      body: z.string().trim().min(1).max(20000),
      purpose: z.enum(["personal", "promotional"]),
      files: z.array(attSchema).max(SES_LIMITS.maxFiles),
      confirmed: z.literal(true),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = (context as any).supabase;
    if (data.to !== data.confirmTo) return { ok: false as const, reason: "Confirmed recipient doesn't match." };
    const c = cfg();
    if (c.missing.length || !EMAIL_RE.test(c.from ?? "")) return { ok: false as const, reason: "SES isn't configured." };
    const b = await basisFor(sb, data.to, data.purpose);
    if (!b.ok) return { ok: false as const, reason: b.reason };

    // Load actual bytes; refuse to send if any file is missing/invalid.
    const atts: { FileName: string; ContentType: string; RawContent: string; ContentDisposition: "ATTACHMENT"; ContentTransferEncoding: "BASE64" }[] = [];
    const meta: { name: string; size: number }[] = [];
    let total = 0;
    for (const f of data.files) {
      const name = safeName(f.name);
      const type = typeFor(name);
      if (!type) return { ok: false as const, reason: `${name}: file type not allowed.` };
      const { data: blob } = await sb.storage.from(BUCKET).download(f.path);
      if (!blob) return { ok: false as const, reason: `${name} is missing or expired. Remove it and add it again.` };
      if (blob.size > SES_LIMITS.maxFileBytes) return { ok: false as const, reason: `${name} is over 10 MB.` };
      total += blob.size;
      if (total > SES_LIMITS.maxTotalBytes) return { ok: false as const, reason: "Attachments exceed 20 MB total." };
      const bytes = new Uint8Array(await blob.arrayBuffer());
      atts.push({ FileName: name, ContentType: type, RawContent: Buffer.from(bytes).toString("base64"), ContentDisposition: "ATTACHMENT", ContentTransferEncoding: "BASE64" });
      meta.push({ name, size: blob.size });
    }

    const footer = data.purpose === "promotional"
      ? "\n\n—\nYou're receiving this because you signed up at mybeatcatalog.com. Reply \"unsubscribe\" and we'll stop emailing you."
      : "";
    const { data: row, error } = await sb.from("ses_send_log").insert({
      to_email: data.to, from_email: c.from, subject: data.subject, body: data.body, purpose: data.purpose,
      basis: b.basis, attachments: meta, status: "pending", sent_by: context.userId,
    }).select("id").single();
    if (error) return { ok: false as const, reason: "Couldn't record the send attempt; nothing was sent." };

    let status = "failed", messageId: string | null = null, err: string | null = null;
    try {
      const res = await ses("/v2/email/outbound-emails", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          FromEmailAddress: c.from,
          Destination: { ToAddresses: [data.to] },
          ReplyToAddresses: (context as any).claims?.email ? [(context as any).claims.email] : undefined,
          Content: { Simple: {
            Subject: { Data: data.subject, Charset: "UTF-8" },
            Body: { Text: { Data: data.body + footer, Charset: "UTF-8" } },
            ...(atts.length ? { Attachments: atts } : {}),
          } },
        }),
      });
      const text = await res.text();
      if (res.ok) { status = "sent"; messageId = (JSON.parse(text) as any).MessageId ?? null; }
      else { err = `SES ${res.status}: ${text.slice(0, 500)}`; console.error(err); }
    } catch (e: any) { err = String(e?.message ?? e).slice(0, 500); }
    await sb.from("ses_send_log").update({ status, ses_message_id: messageId, error: err, updated_at: new Date().toISOString() }).eq("id", row.id);
    return status === "sent" ? { ok: true as const, messageId } : { ok: false as const, reason: err ?? "Send failed." };
  });

export const adminSesLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data } = await (context as any).supabase.from("ses_send_log")
      .select("id, to_email, subject, purpose, status, ses_message_id, error, attachments, created_at")
      .order("created_at", { ascending: false }).limit(25);
    return { rows: data ?? [] };
  });

/** Delete uploads older than 24h that no saved draft references. */
export const adminCleanupEmailUploads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const sb = (context as any).supabase;
    const { data: objs } = await sb.storage.from(BUCKET).list("uploads", { limit: 1000 });
    const { data: drafts } = await sb.from("admin_email_drafts").select("attachments").limit(1000);
    const used = new Set<string>();
    for (const d of drafts ?? []) for (const a of (d.attachments ?? []) as any[]) a?.path && used.add(a.path);
    const cutoff = Date.now() - 24 * 3600 * 1000;
    const stale = (objs ?? [])
      .filter((o: any) => o.created_at && new Date(o.created_at).getTime() < cutoff)
      .map((o: any) => `uploads/${o.name}`)
      .filter((p: string) => !used.has(p));
    if (stale.length) await sb.storage.from(BUCKET).remove(stale);
    return { removed: stale.length };
  });
