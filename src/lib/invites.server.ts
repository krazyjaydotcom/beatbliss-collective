// Server-only helpers used by webhook + admin to issue invites.
import { randomBytes } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export function generateInviteToken(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = randomBytes(12);
  const chars = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]);
  return `${chars.slice(0, 4).join("")}-${chars.slice(4, 8).join("")}-${chars.slice(8, 12).join("")}`;
}

export interface IssueInviteParams {
  email: string;
  stripeCustomerId: string;
  stripeSubscriptionId?: string | null;
  tier: "artist" | "label";
  environment: "sandbox" | "live";
  origin: string; // e.g. https://krazyjay.com
}

export async function issueInviteAndEmail(params: IssueInviteParams): Promise<{
  token: string;
  url: string;
} | null> {
  // Skip if a profile already exists for this customer (existing user re-subscribed)
  const { data: existingProfile } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id", params.stripeCustomerId)
    .maybeSingle();
  if (existingProfile) return null;

  // Skip if there's already an unused, unexpired invite for this customer
  const { data: openInvite } = await supabaseAdmin
    .from("invites")
    .select("token")
    .eq("stripe_customer_id", params.stripeCustomerId)
    .is("used_at", null)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let token = openInvite?.token;
  if (!token) {
    token = generateInviteToken();
    const { error } = await supabaseAdmin.from("invites").insert({
      token,
      email: params.email,
      stripe_customer_id: params.stripeCustomerId,
      stripe_subscription_id: params.stripeSubscriptionId ?? null,
      tier: params.tier,
      environment: params.environment,
    });
    if (error) {
      console.error("[invites] failed to insert invite", error);
      return null;
    }
  }

  const url = `${params.origin}/claim/${token}`;

  await sendInviteEmail({ to: params.email, url, tier: params.tier });

  return { token, url };
}

const TIER_LABEL: Record<string, string> = {
  artist: "Artist / Creator",
  label: "Label",
};

async function sendInviteEmail(opts: { to: string; url: string; tier: string }) {
  const tierLabel = TIER_LABEL[opts.tier] ?? opts.tier;
  const subject = "Your MyBeatCatalog invite — claim your account";
  const html = `<!DOCTYPE html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0a0a0a;color:#fff;margin:0;padding:0">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px">
    <h1 style="font-size:28px;font-weight:900;letter-spacing:-0.02em;margin:0 0 8px">
      My<span style="color:#ff3b3b">Beat</span>Catalog
    </h1>
    <p style="color:#a1a1aa;margin:0 0 32px">Welcome to the catalog.</p>

    <h2 style="font-size:22px;font-weight:800;margin:0 0 12px">Claim your ${tierLabel} membership</h2>
    <p style="color:#d4d4d8;line-height:1.6;margin:0 0 24px">
      Thanks for joining. Click the button below to set your password and unlock the full beat catalog.
      This link is good for one use and expires in <strong>7 days</strong>.
    </p>
    <p style="margin:0 0 32px">
      <a href="${opts.url}" style="display:inline-block;background:#ff3b3b;color:#fff;text-decoration:none;font-weight:700;padding:14px 28px;border-radius:10px">
        Create my account
      </a>
    </p>
    <p style="color:#71717a;font-size:13px;line-height:1.6;margin:0 0 8px">
      Or paste this link into your browser:
    </p>
    <p style="color:#a1a1aa;font-size:13px;word-break:break-all;margin:0 0 32px">
      <a href="${opts.url}" style="color:#ff3b3b">${opts.url}</a>
    </p>
    <hr style="border:none;border-top:1px solid #27272a;margin:32px 0" />
    <p style="color:#71717a;font-size:12px;margin:0">
      Didn't sign up? You can ignore this email. The link will expire on its own.
    </p>
  </div>
</body></html>`;

  const text = `Welcome to MyBeatCatalog.

Claim your ${tierLabel} membership and set your password:
${opts.url}

This link works once and expires in 7 days.`;

  try {
    await supabaseAdmin.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: {
        to: opts.to,
        from: "KRAZYJAYDOTCOM <noreply@notify.krazyjay.com>",
        sender_domain: "notify.krazyjay.com",
        subject,
        html,
        text,
        label: "invite_claim",
        message_id: crypto.randomUUID(),
        queued_at: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error("[invites] failed to enqueue invite email", err);
  }
}
