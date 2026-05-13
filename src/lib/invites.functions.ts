import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { generateInviteToken } from "@/lib/invites.server";

const TIER_LABEL: Record<string, string> = {
  artist: "Artist / Creator",
  label: "Label",
};

export const validateInvite = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string }) => z.object({ token: z.string().min(6).max(20).regex(/^[a-z0-9-]+$/) }).parse(input))
  .handler(async ({ data }) => {
    const { data: invite } = await supabaseAdmin
      .from("invites")
      .select("email, tier, expires_at, used_at, revoked_at")
      .eq("token", data.token)
      .maybeSingle();

    if (!invite) return { ok: false as const, reason: "invalid" as const };
    if (invite.revoked_at) return { ok: false as const, reason: "revoked" as const };
    if (invite.used_at) return { ok: false as const, reason: "used" as const };
    if (new Date(invite.expires_at) < new Date()) {
      return { ok: false as const, reason: "expired" as const };
    }

    return {
      ok: true as const,
      email: invite.email,
      tier: invite.tier,
      tierLabel: TIER_LABEL[invite.tier] ?? invite.tier,
    };
  });

export const claimInvite = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string; password: string }) =>
    z
      .object({
        token: z.string().min(10).max(128),
        password: z.string().min(8).max(128),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<{ ok: boolean; error?: string; email?: string }> => {
    const { data: invite } = await supabaseAdmin
      .from("invites")
      .select("email, tier, expires_at, used_at, revoked_at")
      .eq("token", data.token)
      .maybeSingle();

    if (!invite) return { ok: false, error: "This invite link is invalid." };
    if (invite.revoked_at) return { ok: false, error: "This invite has been revoked." };
    if (invite.used_at) return { ok: false, error: "This invite has already been used." };
    if (new Date(invite.expires_at) < new Date()) {
      return { ok: false, error: "This invite has expired. Contact support for a new link." };
    }

    let userId: string | undefined;

    if (!invite.email) {
      return { ok: false, error: "This invite is missing an email. Use the new join link instead." };
    }

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: invite.email,
      password: data.password,
      email_confirm: true,
    });

    if (createErr) {
      const msg = createErr.message?.toLowerCase() ?? "";
      if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
        return {
          ok: false,
          error: "An account with this email already exists. Please log in instead.",
        };
      }
      return { ok: false, error: createErr.message };
    }

    userId = created.user?.id;
    if (!userId) return { ok: false, error: "Failed to create account." };

    const { error: claimErr } = await supabaseAdmin.rpc("claim_invite", {
      _token: data.token,
      _user_id: userId,
    });

    if (claimErr) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return { ok: false, error: claimErr.message };
    }

    return { ok: true, email: invite.email ?? undefined };
  });

export const createManualInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { email: string; tier: "artist" | "label"; origin: string; environment: "sandbox" | "live" }) =>
      z
        .object({
          email: z.string().email().max(254),
          tier: z.enum(["artist", "label"]),
          origin: z.string().url().max(2048),
          environment: z.enum(["sandbox", "live"]),
        })
        .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const { data: adminRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (!adminRole) {
      throw new Error("Admin access required.");
    }

    const email = data.email.trim().toLowerCase();

    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existingProfile) {
      throw new Error("This email already has a profile. Use the grant/revoke tools below instead.");
    }

    const nowIso = new Date().toISOString();
    const { data: existingInvite, error: existingInviteError } = await supabaseAdmin
      .from("invites")
      .select("token, expires_at")
      .eq("email", email)
      .eq("tier", data.tier)
      .eq("environment", data.environment)
      .is("used_at", null)
      .is("revoked_at", null)
      .gt("expires_at", nowIso)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingInviteError) {
      throw new Error(existingInviteError.message);
    }

    const expiresAt = existingInvite?.expires_at ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    let token = existingInvite?.token ?? null;
    const reused = !!token;

    if (!token) {
      token = generateInviteToken();
      const { error } = await supabaseAdmin.from("invites").insert({
        token,
        email,
        tier: data.tier,
        environment: data.environment,
        expires_at: expiresAt,
        stripe_customer_id: "",
      });

      if (error) {
        throw new Error(error.message);
      }
    }

    const origin = data.origin.replace(/\/+$/, "");

    return {
      ok: true as const,
      email,
      tier: data.tier,
      tierLabel: TIER_LABEL[data.tier] ?? data.tier,
      expiresAt,
      reused,
      url: origin + "/claim/" + token,
    };
  });
